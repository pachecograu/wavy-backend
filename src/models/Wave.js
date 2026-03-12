const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, DeleteCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
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
}

module.exports = Wave;