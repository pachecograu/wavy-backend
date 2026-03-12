const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const client = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = 'wavy-tracks';

class Track {
  static async create(data) {
    const track = {
      trackId: uuidv4(),
      waveId: data.waveId,
      title: data.title,
      artist: data.artist,
      duration: data.duration || null,
      isCurrent: data.isCurrent || false,
      playedAt: new Date().toISOString()
    };
    
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: track
    }));
    
    return track;
  }

  static async findById(trackId) {
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { trackId }
    }));
    return result.Item;
  }

  static async findByWaveId(waveId) {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'waveId-index',
      KeyConditionExpression: 'waveId = :waveId',
      ExpressionAttributeValues: {
        ':waveId': waveId
      }
    }));
    return result.Items;
  }
}

module.exports = Track;