const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, DeleteCommand, ScanCommand, TransactWriteCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const client = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = 'wavy-waves';

class Wave {
  static async create(data) {
    const wave = {
      waveId: uuidv4(),
      name: data.name,
      djName: data.djName,
      ownerId: data.ownerId,
      isOnline: true,
      listenersCount: 0,
      currentTrack: data.currentTrack || null,
      createdAt: new Date().toISOString()
    };
    
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: wave
    }));
    
    return wave;
  }

  static async findById(waveId) {
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { waveId }
    }));
    return result.Item;
  }

  static async update(waveId, updates) {
    const updateExpression = [];
    const expressionAttributeValues = {};
    const expressionAttributeNames = {};
    
    Object.keys(updates).forEach((key, index) => {
      updateExpression.push(`#attr${index} = :val${index}`);
      expressionAttributeNames[`#attr${index}`] = key;
      expressionAttributeValues[`:val${index}`] = updates[key];
    });
    
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { waveId },
      UpdateExpression: `SET ${updateExpression.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues
    }));
  }

  static async delete(waveId) {
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { waveId }
    }));
  }

  static async findAll() {
    const result = await docClient.send(new ScanCommand({
      TableName: TABLE_NAME
    }));
    return result.Items;
  }

  /**
   * Create wave with transaction (atomic operation)
   * Creates wave and updates user's active wave count
   */
  static async createWithTransaction(data) {
    const wave = {
      waveId: uuidv4(),
      name: data.name,
      djName: data.djName,
      ownerId: data.ownerId,
      genre: data.genre || 'Sin información',
      description: data.description || 'Sin información',
      isOnline: true,
      listenersCount: 0,
      currentTrack: data.currentTrack || null,
      createdAt: new Date().toISOString()
    };

    const transactItems = [
      {
        Put: {
          TableName: TABLE_NAME,
          Item: wave
        }
      },
      {
        Update: {
          TableName: 'wavy-users',
          Key: { userId: data.ownerId },
          UpdateExpression: 'SET activeWaveId = :waveId, updatedAt = :now',
          ExpressionAttributeValues: {
            ':waveId': wave.waveId,
            ':now': new Date().toISOString()
          }
        }
      }
    ];

    await docClient.send(new TransactWriteCommand({
      TransactItems: transactItems
    }));

    return wave;
  }

  /**
   * Stop wave with transaction (atomic operation)
   * Marks wave offline and clears user's active wave
   */
  static async stopWithTransaction(waveId, ownerId) {
    const transactItems = [
      {
        Update: {
          TableName: TABLE_NAME,
          Key: { waveId },
          UpdateExpression: 'SET isOnline = :offline, stoppedAt = :now',
          ExpressionAttributeValues: {
            ':offline': false,
            ':now': new Date().toISOString()
          }
        }
      },
      {
        Update: {
          TableName: 'wavy-users',
          Key: { userId: ownerId },
          UpdateExpression: 'REMOVE activeWaveId SET updatedAt = :now',
          ExpressionAttributeValues: {
            ':now': new Date().toISOString()
          }
        }
      }
    ];

    await docClient.send(new TransactWriteCommand({
      TransactItems: transactItems
    }));
  }

  /**
   * Join wave with transaction (atomic operation)
   * Increments listener count and records user session
   */
  static async joinWithTransaction(waveId, userId) {
    const sessionId = uuidv4();
    const transactItems = [
      {
        Update: {
          TableName: TABLE_NAME,
          Key: { waveId },
          UpdateExpression: 'SET listenersCount = listenersCount + :inc',
          ExpressionAttributeValues: {
            ':inc': 1
          }
        }
      },
      {
        Put: {
          TableName: 'wavy-backend-sessions',
          Item: {
            sessionId,
            waveId,
            userId,
            joinedAt: new Date().toISOString(),
            isActive: true
          }
        }
      }
    ];

    await docClient.send(new TransactWriteCommand({
      TransactItems: transactItems
    }));

    return sessionId;
  }

  /**
   * Leave wave with transaction (atomic operation)
   * Decrements listener count and marks session inactive
   */
  static async leaveWithTransaction(waveId, sessionId) {
    const transactItems = [
      {
        Update: {
          TableName: TABLE_NAME,
          Key: { waveId },
          UpdateExpression: 'SET listenersCount = listenersCount - :dec',
          ExpressionAttributeValues: {
            ':dec': 1
          },
          ConditionExpression: 'listenersCount > :zero',
          ExpressionAttributeValues: {
            ':dec': 1,
            ':zero': 0
          }
        }
      },
      {
        Update: {
          TableName: 'wavy-backend-sessions',
          Key: { sessionId },
          UpdateExpression: 'SET isActive = :inactive, leftAt = :now',
          ExpressionAttributeValues: {
            ':inactive': false,
            ':now': new Date().toISOString()
          }
        }
      }
    ];

    await docClient.send(new TransactWriteCommand({
      TransactItems: transactItems
    }));
  }
}

module.exports = Wave;