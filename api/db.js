import { MongoClient, ServerApiVersion } from 'mongodb';
import 'dotenv/config';

let client;
let db;

export async function connectDb() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set');
  }
  if (db) return db;

  client = new MongoClient(process.env.MONGODB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true
    }
  });

  await client.connect();
  db = client.db('fy27abr');
  for (const name of ['registrations', 'groups', 'votingSessions', 'votes']) {
    try {
      await db.createCollection(name);
    } catch (err) {
      if (err.code !== 48) throw err;
    }
  }
  console.log('Connected to MongoDB');
  return db;
}

export function getRegistrationsCollection() {
  if (!db) throw new Error('Database not connected');
  return db.collection('registrations');
}

export function getGroupsCollection() {
  if (!db) throw new Error('Database not connected');
  return db.collection('groups');
}

export function getVotingSessionsCollection() {
  if (!db) throw new Error('Database not connected');
  return db.collection('votingSessions');
}

export function getVotesCollection() {
  if (!db) throw new Error('Database not connected');
  return db.collection('votes');
}

export async function closeDb() {
  if (client) await client.close();
}
