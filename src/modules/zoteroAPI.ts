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
      const text = await (Zotero.FullText as any).getItemText(itemID);
      return text || "Unable to retrieve paper content. Please ensure the PDF has been indexed.";
    } catch (error) {
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
