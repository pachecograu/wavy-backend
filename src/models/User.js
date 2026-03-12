const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const client = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = 'wavy-users';

class User {
  static async create(data) {
    const user = {
      userId: uuidv4(),
      authType: data.authType,
      displayName: data.displayName,
      avatar: data.avatar || null,
      createdAt: new Date().toISOString()
    };
    
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: user
    }));
    
    return user;
  }

  static async findById(userId) {
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { userId }
    }));
    return result.Item;
  }

  static async findAll() {
    const result = await docClient.send(new ScanCommand({
      TableName: TABLE_NAME
    }));
    return result.Items;
  }
}

module.exports = User;