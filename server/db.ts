import { eq, and, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users, 
  motions, InsertMotion, Motion,
  debateSessions, InsertDebateSession, DebateSession,
  debateParticipants, InsertDebateParticipant, DebateParticipant,
  speeches, InsertSpeech, Speech,
  transcriptSegments, InsertTranscriptSegment,
  arguments_, InsertArgument, Argument,
  argumentRelationships, InsertArgumentRelationship,
  pointsOfInformation, InsertPointOfInformation,
  ruleViolations, InsertRuleViolation,
  debateFeedback, InsertDebateFeedback,
  userMetrics, InsertUserMetric
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { nanoid } from 'nanoid';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============ USER QUERIES ============

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============ MOTION QUERIES ============

export async function createMotion(motion: InsertMotion) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(motions).values(motion);
  return result[0].insertId;
}

export async function getMotionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(motions).where(eq(motions.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getMotions(filters?: { topic?: string; difficulty?: string }) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(motions);
  
  if (filters?.topic) {
    query = query.where(eq(motions.topic, filters.topic as any)) as any;
  }
  if (filters?.difficulty) {
    query = query.where(eq(motions.difficulty, filters.difficulty as any)) as any;
  }
  
  return await query.orderBy(desc(motions.createdAt));
}

// ============ DEBATE SESSION QUERIES ============

function generateRoomCode(): string {
  return nanoid(8).toUpperCase();
}

export async function createDebateSession(session: Omit<InsertDebateSession, 'roomCode'>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const roomCode = generateRoomCode();
  const result = await db.insert(debateSessions).values({
    ...session,
    roomCode,
  });
  
  return { id: result[0].insertId, roomCode };
}

export async function getDebateSessionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(debateSessions).where(eq(debateSessions.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getDebateSessionByRoomCode(roomCode: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(debateSessions).where(eq(debateSessions.roomCode, roomCode)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateDebateSession(id: number, updates: Partial<InsertDebateSession>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(debateSessions).set(updates).where(eq(debateSessions.id, id));
}

export async function getUserDebateSessions(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const participantSessions = await db
    .select({ sessionId: debateParticipants.sessionId })
    .from(debateParticipants)
    .where(eq(debateParticipants.userId, userId));
  
  if (participantSessions.length === 0) return [];
  
  const sessionIds = participantSessions.map(p => p.sessionId);
  const sessions = await db
    .select()
    .from(debateSessions)
    .where(sql`${debateSessions.id} IN (${sql.join(sessionIds, sql`, `)})`)
    .orderBy(desc(debateSessions.createdAt));
  
  return sessions;
}

// ============ PARTICIPANT QUERIES ============

export async function addParticipant(participant: InsertDebateParticipant) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(debateParticipants).values(participant);
  return result[0].insertId;
}

export async function getSessionParticipants(sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(debateParticipants).where(eq(debateParticipants.sessionId, sessionId));
}

export async function updateParticipantConnection(participantId: number, isConnected: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(debateParticipants).set({ isConnected }).where(eq(debateParticipants.id, participantId));
}

export async function getParticipantByUserAndSession(userId: number, sessionId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(debateParticipants)
    .where(and(eq(debateParticipants.userId, userId), eq(debateParticipants.sessionId, sessionId)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============ SPEECH QUERIES ============

export async function createSpeech(speech: InsertSpeech) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(speeches).values(speech);
  return result[0].insertId;
}

export async function updateSpeech(id: number, updates: Partial<InsertSpeech>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(speeches).set(updates).where(eq(speeches.id, id));
}

export async function getSessionSpeeches(sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(speeches).where(eq(speeches.sessionId, sessionId)).orderBy(speeches.startedAt);
}

export async function getSpeechById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(speeches).where(eq(speeches.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============ TRANSCRIPT SEGMENT QUERIES ============

export async function addTranscriptSegment(segment: InsertTranscriptSegment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(transcriptSegments).values(segment);
  return result[0].insertId;
}

export async function getSpeechTranscriptSegments(speechId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(transcriptSegments).where(eq(transcriptSegments.speechId, speechId)).orderBy(transcriptSegments.startTime);
}

// ============ ARGUMENT QUERIES ============

export async function createArgument(argument: InsertArgument) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(arguments_).values(argument);
  return result[0].insertId;
}

export async function getSessionArguments(sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(arguments_).where(eq(arguments_.sessionId, sessionId));
}

export async function updateArgument(id: number, updates: Partial<InsertArgument>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(arguments_).set(updates).where(eq(arguments_.id, id));
}

// ============ ARGUMENT RELATIONSHIP QUERIES ============

export async function createArgumentRelationship(relationship: InsertArgumentRelationship) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(argumentRelationships).values(relationship);
  return result[0].insertId;
}

export async function getSessionArgumentRelationships(sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(argumentRelationships).where(eq(argumentRelationships.sessionId, sessionId));
}

// ============ POI QUERIES ============

export async function createPOI(poi: InsertPointOfInformation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(pointsOfInformation).values(poi);
  return result[0].insertId;
}

export async function getSessionPOIs(sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(pointsOfInformation).where(eq(pointsOfInformation.sessionId, sessionId));
}

// ============ RULE VIOLATION QUERIES ============

export async function createRuleViolation(violation: InsertRuleViolation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(ruleViolations).values(violation);
  return result[0].insertId;
}

export async function getSessionRuleViolations(sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(ruleViolations).where(eq(ruleViolations.sessionId, sessionId));
}

// ============ FEEDBACK QUERIES ============

export async function createDebateFeedback(feedback: InsertDebateFeedback) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(debateFeedback).values(feedback);
  return result[0].insertId;
}

export async function getSessionFeedback(sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(debateFeedback).where(eq(debateFeedback.sessionId, sessionId));
}

export async function getParticipantFeedback(participantId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(debateFeedback).where(eq(debateFeedback.participantId, participantId));
}

// ============ USER METRICS QUERIES ============

export async function createUserMetric(metric: InsertUserMetric) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(userMetrics).values(metric);
  return result[0].insertId;
}

export async function getUserMetrics(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(userMetrics).where(eq(userMetrics.userId, userId)).orderBy(desc(userMetrics.createdAt));
}

export async function getUserMetricsForSession(userId: number, sessionId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(userMetrics)
    .where(and(eq(userMetrics.userId, userId), eq(userMetrics.sessionId, sessionId)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============ AGGREGATE QUERIES ============

export async function getDebateSessionWithDetails(sessionId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const session = await getDebateSessionById(sessionId);
  if (!session) return null;
  
  const [motion, participants, sessionSpeeches, sessionArguments, relationships, pois, violations, feedback] = await Promise.all([
    session.motionId ? getMotionById(session.motionId) : null,
    getSessionParticipants(sessionId),
    getSessionSpeeches(sessionId),
    getSessionArguments(sessionId),
    getSessionArgumentRelationships(sessionId),
    getSessionPOIs(sessionId),
    getSessionRuleViolations(sessionId),
    getSessionFeedback(sessionId),
  ]);
  
  // Get metrics for all participants
  const participantUserIds = participants.map(p => p.userId);
  const metricsResults = await Promise.all(
    participantUserIds.map(userId => getUserMetricsForSession(userId, sessionId))
  );
  const metrics = metricsResults.filter((m): m is NonNullable<typeof m> => m !== null && m !== undefined);
  
  return {
    session,
    motion,
    participants,
    speeches: sessionSpeeches,
    arguments: sessionArguments,
    relationships,
    pois,
    violations,
    feedback,
    metrics,
  };
}

export async function getUserProgressStats(userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const metrics = await getUserMetrics(userId);
  if (metrics.length === 0) return null;
  
  const avgMetrics = {
    avgResponsiveness: metrics.reduce((sum, m) => sum + (m.responsivenessScore || 0), 0) / metrics.length,
    avgRebuttalQuality: metrics.reduce((sum, m) => sum + (m.rebuttalQuality || 0), 0) / metrics.length,
    avgArgumentCompleteness: metrics.reduce((sum, m) => sum + (m.argumentCompleteness || 0), 0) / metrics.length,
    avgWeighingUsage: metrics.reduce((sum, m) => sum + (m.weighingUsage || 0), 0) / metrics.length,
    avgRoleFulfillment: metrics.reduce((sum, m) => sum + (m.roleFulfillment || 0), 0) / metrics.length,
    avgOverallPerformance: metrics.reduce((sum, m) => sum + (m.overallPerformance || 0), 0) / metrics.length,
    totalDebates: metrics.length,
    recentMetrics: metrics.slice(0, 10),
  };
  
  return avgMetrics;
}
