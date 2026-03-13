const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const client = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = 'wavy-backend-sessions';

class Session {
  static async create(data) {
    const session = {
      sessionId: uuidv4(),
      waveId: data.waveId,
      userId: data.userId,
      joinedAt: new Date().toISOString(),
      isActive: true
    };
    
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: session
    }));
    
    return session;
  }

  static async findById(sessionId) {
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { sessionId }
    }));
    return result.Item;
  }

  static async findByWaveId(waveId) {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'waveId-index',
      KeyConditionExpression: 'waveId = :waveId',
      FilterExpression: 'isActive = :active',
      ExpressionAttributeValues: {
        ':waveId': waveId,
        ':active': true
      }
    }));
    return result.Items;
  }

  static async markInactive(sessionId) {
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { sessionId },
      UpdateExpression: 'SET isActive = :inactive, leftAt = :now',
      ExpressionAttributeValues: {
        ':inactive': false,
        ':now': new Date().toISOString()
      }
    }));
  }
}

module.exports = Session;
