export class StorageManager {
  private dbConnection: any;

  async init() {
    await this.createTables();
  }

  private async createTables() {
    const conversationsTable = `
      CREATE TABLE IF NOT EXISTS marginalia_conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        itemID INTEGER NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        toolCalls JSON,
        FOREIGN KEY (itemID) REFERENCES items(itemID)
      )
    `;

    const settingsTable = `
      CREATE TABLE IF NOT EXISTS marginalia_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `;

    try {
      await Zotero.DB.queryAsync(conversationsTable);
      await Zotero.DB.queryAsync(settingsTable);
    } catch (error) {
      ztoolkit.log("Error creating tables:", error);
    }
  }

  async saveMessage(itemID: number, role: string, content: string, toolCalls?: any) {
    const timestamp = Math.floor(Date.now() / 1000);
    const sql = `
      INSERT INTO marginalia_conversations (itemID, role, content, timestamp, toolCalls)
      VALUES (?, ?, ?, ?, ?)
    `;
    try {
      await Zotero.DB.queryAsync(sql, [itemID, role, content, timestamp, toolCalls ? JSON.stringify(toolCalls) : null]);
    } catch (error) {
      ztoolkit.log("Error saving message:", error);
    }
  }

  async getMessages(itemID: number): Promise<Array<{ role: string; content: string; toolCalls?: any }>> {
    const sql = `
      SELECT role, content, toolCalls FROM marginalia_conversations
      WHERE itemID = ?
      ORDER BY timestamp ASC
    `;
    try {
      const rows = (await Zotero.DB.queryAsync(sql, [itemID])) as any[];
      return (
        rows?.map((row: any) => ({
          role: row.role,
          content: row.content,
          toolCalls: row.toolCalls ? JSON.parse(row.toolCalls) : undefined,
        })) || []
      );
    } catch (error) {
      ztoolkit.log("Error loading messages:", error);
      return [];
    }
  }

  async clearMessages(itemID: number) {
    const sql = `DELETE FROM marginalia_conversations WHERE itemID = ?`;
    try {
      await Zotero.DB.queryAsync(sql, [itemID]);
    } catch (error) {
      ztoolkit.log("Error clearing messages:", error);
    }
  }

  async deleteOldestMessages(itemID: number, count: number) {
    // 删除最早的 count 条消息
    const sql = `
      DELETE FROM marginalia_conversations
      WHERE id IN (
        SELECT id FROM marginalia_conversations
        WHERE itemID = ?
        ORDER BY timestamp ASC
        LIMIT ?
      )
    `;
    try {
      await Zotero.DB.queryAsync(sql, [itemID, count]);
    } catch (error) {
      ztoolkit.log("Error deleting oldest messages:", error);
    }
  }

  async saveSetting(key: string, value: string) {
    const sql = `
      INSERT OR REPLACE INTO marginalia_settings (key, value)
      VALUES (?, ?)
    `;
    try {
      await Zotero.DB.queryAsync(sql, [key, value]);
    } catch (error) {
      ztoolkit.log("Error saving setting:", error);
    }
  }

  async getSetting(key: string): Promise<string | null> {
    const sql = `SELECT value FROM marginalia_settings WHERE key = ?`;
    try {
      const rows = (await Zotero.DB.queryAsync(sql, [key])) as any[];
      return rows?.[0]?.value || null;
    } catch (error) {
      ztoolkit.log("Error loading setting:", error);
      return null;
    }
  }
}
