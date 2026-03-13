const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = 'wavy-backend-cache';

class Cache {
  /**
   * Set cache item with TTL
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttlSeconds - Time to live in seconds (default 3600 = 1 hour)
   */
  static async set(key, value, ttlSeconds = 3600) {
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + ttlSeconds;
    
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        cacheKey: key,
        value: value,
        ttl: expiresAt,
        createdAt: new Date().toISOString()
      }
    }));
  }

  /**
   * Get cache item
   * @param {string} key - Cache key
   * @returns {any|null} Cached value or null if not found/expired
   */
  static async get(key) {
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { cacheKey: key }
    }));
    
    if (!result.Item) {
      return null;
    }
    
    const now = Math.floor(Date.now() / 1000);
    if (result.Item.ttl && result.Item.ttl < now) {
      // Expired, delete it
      await this.delete(key);
      return null;
    }
    
    return result.Item.value;
  }

  /**
   * Delete cache item
   * @param {string} key - Cache key
   */
  static async delete(key) {
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { cacheKey: key }
    }));
  }

  /**
   * Cache LiveKit token
   * @param {string} roomId - Room ID
   * @param {string} userId - User ID
   * @param {object} tokenData - Token data to cache
   */
  static async cacheVoiceToken(roomId, userId, tokenData) {
    const key = `voice_token:${roomId}:${userId}`;
    await this.set(key, tokenData, 3600); // 1 hour TTL
  }

  /**
   * Get cached LiveKit token
   * @param {string} roomId - Room ID
   * @param {string} userId - User ID
   * @returns {object|null} Cached token or null
   */
  static async getCachedVoiceToken(roomId, userId) {
    const key = `voice_token:${roomId}:${userId}`;
    return await this.get(key);
  }

  /**
   * Cache wave data
   * @param {string} waveId - Wave ID
   * @param {object} waveData - Wave data to cache
   */
  static async cacheWave(waveId, waveData) {
    const key = `wave:${waveId}`;
    await this.set(key, waveData, 300); // 5 minutes TTL
  }

  /**
   * Get cached wave data
   * @param {string} waveId - Wave ID
   * @returns {object|null} Cached wave or null
   */
  static async getCachedWave(waveId) {
    const key = `wave:${waveId}`;
    return await this.get(key);
  }
}

module.exports = Cache;
