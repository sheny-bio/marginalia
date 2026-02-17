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

  static async getPaperContent(itemID: number): Promise<string> {
    try {
      const item = Zotero.Items.get(itemID);
      if (!item) {
        return "Item not found.";
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
            const content = await (Zotero.Fulltext as any).getItemContent(attachmentID);
            ztoolkit.log("[ZoteroAPI] getItemContent result:", content ? "got content" : "no content");
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
              ztoolkit.log("[ZoteroAPI] Cache file content length:", typeof text === 'string' ? text.length : 'N/A');
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
            const content = await (Zotero.Fulltext as any).getItemContent(attachmentID);
            if (content && content.content) {
              return content.content;
            }
          } catch (e) {
            ztoolkit.log("[ZoteroAPI] Index and get failed:", e);
          }
        }
      }

      return "Unable to retrieve paper content. Please ensure the PDF has been indexed (Edit > Preferences > Search > Rebuild Index).";
    } catch (error) {
      ztoolkit.log("[ZoteroAPI] Error:", error);
      return `Error retrieving content: ${error}`;
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
}
