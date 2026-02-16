export class StorageManager {
  private dataDir: string = "";

  async init() {
    ztoolkit.log("[StorageManager] Initializing...");
    // 使用 Zotero 数据目录下的 marginalia 文件夹
    this.dataDir = Zotero.DataDirectory.dir + "/marginalia";
    ztoolkit.log("[StorageManager] Data directory:", this.dataDir);

    // 确保目录存在
    if (!(await IOUtils.exists(this.dataDir))) {
      await IOUtils.makeDirectory(this.dataDir, { createAncestors: true });
      ztoolkit.log("[StorageManager] Created data directory");
    }
    ztoolkit.log("[StorageManager] Initialized successfully");
  }

  private getConversationFilePath(itemID: number): string {
    return this.dataDir + `/conversation_${itemID}.json`;
  }

  private getSettingsFilePath(): string {
    return this.dataDir + "/settings.json";
  }

  async saveMessage(itemID: number, role: string, content: string, toolCalls?: any) {
    ztoolkit.log("[StorageManager] Saving message:", { itemID, role, contentLength: content.length });

    const filePath = this.getConversationFilePath(itemID);
    let messages: any[] = [];

    // 读取现有消息
    try {
      if (await IOUtils.exists(filePath)) {
        const data = await IOUtils.readUTF8(filePath);
        messages = JSON.parse(data);
      }
    } catch (error) {
      ztoolkit.log("[StorageManager] Error reading existing messages:", error);
    }

    // 添加新消息
    messages.push({
      role,
      content,
      timestamp: Math.floor(Date.now() / 1000),
      toolCalls: toolCalls || undefined,
    });

    // 保存到文件
    try {
      await IOUtils.writeUTF8(filePath, JSON.stringify(messages, null, 2));
      ztoolkit.log("[StorageManager] Message saved successfully to:", filePath);
    } catch (error) {
      ztoolkit.log("[StorageManager] Error saving message:", error);
      throw error;
    }
  }

  async getMessages(itemID: number): Promise<Array<{ role: string; content: string; toolCalls?: any }>> {
    ztoolkit.log("[StorageManager] Loading messages for itemID:", itemID);

    const filePath = this.getConversationFilePath(itemID);

    try {
      if (await IOUtils.exists(filePath)) {
        const data = await IOUtils.readUTF8(filePath);
        const messages = JSON.parse(data);
        ztoolkit.log("[StorageManager] Loaded", messages.length, "messages from:", filePath);
        return messages.map((msg: any) => ({
          role: msg.role,
          content: msg.content,
          toolCalls: msg.toolCalls,
        }));
      }
    } catch (error) {
      ztoolkit.log("[StorageManager] Error loading messages:", error);
    }

    ztoolkit.log("[StorageManager] No messages found for itemID:", itemID);
    return [];
  }

  async clearMessages(itemID: number) {
    const filePath = this.getConversationFilePath(itemID);
    try {
      if (await IOUtils.exists(filePath)) {
        await IOUtils.remove(filePath);
        ztoolkit.log("[StorageManager] Cleared messages for itemID:", itemID);
      }
    } catch (error) {
      ztoolkit.log("[StorageManager] Error clearing messages:", error);
    }
  }

  async deleteOldestMessages(itemID: number, count: number) {
    const filePath = this.getConversationFilePath(itemID);
    try {
      if (await IOUtils.exists(filePath)) {
        const data = await IOUtils.readUTF8(filePath);
        let messages = JSON.parse(data);
        if (messages.length > count) {
          messages = messages.slice(count);
          await IOUtils.writeUTF8(filePath, JSON.stringify(messages, null, 2));
          ztoolkit.log("[StorageManager] Deleted oldest", count, "messages");
        }
      }
    } catch (error) {
      ztoolkit.log("[StorageManager] Error deleting oldest messages:", error);
    }
  }

  async saveSetting(key: string, value: string) {
    const filePath = this.getSettingsFilePath();
    let settings: Record<string, string> = {};

    try {
      if (await IOUtils.exists(filePath)) {
        const data = await IOUtils.readUTF8(filePath);
        settings = JSON.parse(data);
      }
    } catch (error) {
      ztoolkit.log("[StorageManager] Error reading settings:", error);
    }

    settings[key] = value;

    try {
      await IOUtils.writeUTF8(filePath, JSON.stringify(settings, null, 2));
    } catch (error) {
      ztoolkit.log("[StorageManager] Error saving setting:", error);
    }
  }

  async getSetting(key: string): Promise<string | null> {
    const filePath = this.getSettingsFilePath();

    try {
      if (await IOUtils.exists(filePath)) {
        const data = await IOUtils.readUTF8(filePath);
        const settings = JSON.parse(data);
        return settings[key] || null;
      }
    } catch (error) {
      ztoolkit.log("[StorageManager] Error loading setting:", error);
    }

    return null;
  }
}