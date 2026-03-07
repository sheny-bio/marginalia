export class ZoteroAPI {
  static getPaperInfo(itemID: number) {
    const item = Zotero.Items.get(itemID);
    if (!item) return null;

    return {
      id: item.id,
      title: item.getField("title"),
      authors: item.getCreators(),
      abstract: item.getField("abstractNote"),
      year: item.getField("date"),
      tags: item.getTags(),
    };
  }

  static async getPaperContent(itemID: number): Promise<string | null> {
    try {
      const item = Zotero.Items.get(itemID);
      if (!item) {
        return null;
      }

      // 获取 PDF 附件
      const attachmentIDs = item.getAttachments();
      ztoolkit.log("[ZoteroAPI] Attachment IDs:", attachmentIDs);

      for (const attachmentID of attachmentIDs) {
        const attachment = Zotero.Items.get(attachmentID);
        if (!attachment) continue;

        const contentType = attachment.attachmentContentType;
        ztoolkit.log("[ZoteroAPI] Attachment contentType:", contentType);

        if (contentType === "application/pdf") {
          // 方法1: 尝试从全文索引获取
          try {
            ztoolkit.log("[ZoteroAPI] Trying Zotero.Fulltext.getItemContent");
            const content = await (Zotero.Fulltext as any).getItemContent(
              attachmentID,
            );
            ztoolkit.log(
              "[ZoteroAPI] getItemContent result:",
              content ? "got content" : "no content",
            );
            if (content && content.content) {
              return content.content;
            }
          } catch (e) {
            ztoolkit.log("[ZoteroAPI] getItemContent failed:", e);
          }

          // 方法2: 尝试从缓存文件读取
          try {
            ztoolkit.log("[ZoteroAPI] Trying cache file");
            const cacheFile = Zotero.Fulltext.getItemCacheFile(attachment);
            ztoolkit.log("[ZoteroAPI] Cache file:", cacheFile?.path);
            if (cacheFile && (await cacheFile.exists())) {
              const text = await Zotero.File.getContentsAsync(cacheFile);
              ztoolkit.log(
                "[ZoteroAPI] Cache file content length:",
                typeof text === "string" ? text.length : "N/A",
              );
              if (text) {
                return text as string;
              }
            }
          } catch (e) {
            ztoolkit.log("[ZoteroAPI] Cache file failed:", e);
          }

          // 方法3: 尝试触发索引并获取
          try {
            ztoolkit.log("[ZoteroAPI] Trying to index and get content");
            await Zotero.Fulltext.indexItems([attachmentID]);
            const content = await (Zotero.Fulltext as any).getItemContent(
              attachmentID,
            );
            if (content && content.content) {
              return content.content;
            }
          } catch (e) {
            ztoolkit.log("[ZoteroAPI] Index and get failed:", e);
          }
        }
      }

      return null;
    } catch (error) {
      ztoolkit.log("[ZoteroAPI] Error:", error);
      return null;
    }
  }

  static async searchPapers(query: string, limit: number = 10) {
    const search = new Zotero.Search();
    search.addCondition("title", "contains", query);
    const results = (await search.search()) as number[];
    return results.slice(0, limit).map((id: number) => this.getPaperInfo(id));
  }

  static getSelectedItem() {
    const pane = Zotero.getActiveZoteroPane();
    const items = pane?.getSelectedItems();
    return items && items.length > 0 ? items[0] : null;
  }

  static getCollectionItems(collectionID: number): Array<{
    index: number;
    title: string;
    authors: string;
    year: string;
    abstract: string;
  }> {
    const collection = Zotero.Collections.get(collectionID);
    if (!collection) return [];

    const items = collection
      .getChildItems(false, false)
      .filter((item: Zotero.Item) => !item.isAttachment() && !item.isNote());

    return items.map((item: Zotero.Item, index: number) => {
      const abstract = (item.getField("abstractNote") as string) || "";
      return {
        index: index + 1,
        title: (item.getField("title") as string) || "未知标题",
        authors:
          item
            .getCreators()
            .map((a: any) => `${a.firstName || ""} ${a.lastName || ""}`.trim())
            .filter(Boolean)
            .join(", ") || "未知作者",
        year: (item.getField("date") as string) || "未知年份",
        abstract:
          abstract.length > 300 ? abstract.substring(0, 300) + "..." : abstract,
      };
    });
  }

  /**
   * 获取当前活跃的 PDF reader 上下文（pdfViewer + iframeDocument）。
   * 仅在 PDF 阅读器标签页处于激活状态时返回有效结果。
   */
  static getActivePdfReaderContext(): {
    pdfViewer: any;
    iframeDocument: Document;
  } | null {
    try {
      const win = Zotero.getMainWindow();
      const tabs = (win as any)?.Zotero_Tabs;
      const tabID = tabs?.selectedID;
      if (!tabID) return null;

      const reader = Zotero.Reader.getByTabID(tabID);
      if (!reader) return null;

      const internalReader = (reader as any)._internalReader;
      if (!internalReader) return null;

      const iframeWindow =
        internalReader._primaryView?._iframeWindow ??
        internalReader._iframeWindow;
      if (!iframeWindow) return null;

      const pdfViewer = (iframeWindow as any).PDFViewerApplication?.pdfViewer;
      if (!pdfViewer) return null;

      return {
        pdfViewer,
        iframeDocument: iframeWindow.document,
      };
    } catch (e) {
      ztoolkit.log("[ZoteroAPI] getActivePdfReaderContext error:", e);
      return null;
    }
  }

  /**
   * 将 PDF 指定页渲染为 JPEG base64 字符串。
   * 优先抓取已渲染的 canvas，未渲染时强制 draw 后再抓取。
   */
  static async renderPageToBase64(
    pdfViewer: any,
    pageNumber: number,
  ): Promise<string | null> {
    try {
      const pageView = pdfViewer.getPageView(pageNumber - 1);
      if (!pageView) return null;

      // 已渲染的页面，直接抓 canvas
      if (pageView.canvas) {
        return pageView.canvas.toDataURL("image/jpeg", 0.85);
      }

      // 未渲染的页面，调用 draw() 强制渲染
      if (typeof pageView.draw === "function") {
        await pageView.draw();
        if (pageView.canvas) {
          return pageView.canvas.toDataURL("image/jpeg", 0.85);
        }
      }

      return null;
    } catch (e) {
      ztoolkit.log("[ZoteroAPI] renderPageToBase64 error:", e);
      return null;
    }
  }

  /**
   * 逐页提取 PDF 文本内容，带 [Page X] 分页标记。
   * 通过 pdfViewer 的 pageView.pdfPage 提取文本。
   */
  static async getPaperContentWithPages(
    pdfViewer: any,
  ): Promise<string | null> {
    try {
      const numPages = pdfViewer.pagesCount;
      if (!numPages) return null;

      const parts: string[] = [];

      for (let i = 0; i < numPages; i++) {
        const pageView = pdfViewer.getPageView(i);
        const pdfPage = pageView?.pdfPage;
        if (!pdfPage || typeof pdfPage.getTextContent !== "function") continue;

        const textContent = await pdfPage.getTextContent();
        const text = textContent.items
          .map((item: any) => item.str)
          .join("")
          .trim();

        if (text) {
          parts.push(`[Page ${i + 1}]\n${text}`);
        }
      }

      return parts.length > 0 ? parts.join("\n\n") : null;
    } catch (e) {
      ztoolkit.log("[ZoteroAPI] getPaperContentWithPages error:", e);
      return null;
    }
  }
}
