import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, boolean, float } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Debate motions - AI-generated or custom debate topics
 */
export const motions = mysqlTable("motions", {
  id: int("id").autoincrement().primaryKey(),
  title: text("title").notNull(),
  topic: mysqlEnum("topic", ["politics", "ethics", "technology", "economics", "social", "environment", "education", "health"]).notNull(),
  difficulty: mysqlEnum("difficulty", ["novice", "intermediate", "advanced"]).notNull(),
  format: mysqlEnum("format", ["asian_parliamentary", "british_parliamentary", "world_schools"]).default("asian_parliamentary").notNull(),
  backgroundContext: text("backgroundContext"),
  stakeholders: json("stakeholders").$type<string[]>(),
  createdBy: int("createdBy").references(() => users.id),
  isAiGenerated: boolean("isAiGenerated").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Motion = typeof motions.$inferSelect;
export type InsertMotion = typeof motions.$inferInsert;

/**
 * Debate sessions - live debate rooms
 */
export const debateSessions = mysqlTable("debate_sessions", {
  id: int("id").autoincrement().primaryKey(),
  roomCode: varchar("roomCode", { length: 8 }).notNull().unique(),
  motionId: int("motionId").references(() => motions.id),
  status: mysqlEnum("status", ["waiting", "in_progress", "completed", "cancelled"]).default("waiting").notNull(),
  format: mysqlEnum("format", ["asian_parliamentary", "british_parliamentary", "world_schools"]).default("asian_parliamentary").notNull(),
  currentSpeakerIndex: int("currentSpeakerIndex").default(0).notNull(),
  currentSpeakerStartTime: timestamp("currentSpeakerStartTime"),
  createdBy: int("createdBy").references(() => users.id),
  startedAt: timestamp("startedAt"),
  endedAt: timestamp("endedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DebateSession = typeof debateSessions.$inferSelect;
export type InsertDebateSession = typeof debateSessions.$inferInsert;

/**
 * Debate participants - debaters in a session
 */
export const debateParticipants = mysqlTable("debate_participants", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").references(() => debateSessions.id).notNull(),
  userId: int("userId").references(() => users.id).notNull(),
  team: mysqlEnum("team", ["government", "opposition"]).notNull(),
  speakerRole: mysqlEnum("speakerRole", ["pm", "dpm", "gw", "lo", "dlo", "ow", "pmr", "lor"]).notNull(),
  isConnected: boolean("isConnected").default(false).notNull(),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
});

export type DebateParticipant = typeof debateParticipants.$inferSelect;
export type InsertDebateParticipant = typeof debateParticipants.$inferInsert;

/**
 * Speeches - individual speech records with transcription
 */
export const speeches = mysqlTable("speeches", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").references(() => debateSessions.id).notNull(),
  participantId: int("participantId").references(() => debateParticipants.id).notNull(),
  speakerRole: mysqlEnum("speakerRole", ["pm", "dpm", "gw", "lo", "dlo", "ow", "pmr", "lor"]).notNull(),
  transcript: text("transcript"),
  audioUrl: varchar("audioUrl", { length: 512 }),
  duration: int("duration"), // in seconds
  startedAt: timestamp("startedAt"),
  endedAt: timestamp("endedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Speech = typeof speeches.$inferSelect;
export type InsertSpeech = typeof speeches.$inferInsert;

/**
 * Transcript segments - timestamped segments of speech
 */
export const transcriptSegments = mysqlTable("transcript_segments", {
  id: int("id").autoincrement().primaryKey(),
  speechId: int("speechId").references(() => speeches.id).notNull(),
  text: text("text").notNull(),
  startTime: float("startTime").notNull(), // seconds from speech start
  endTime: float("endTime").notNull(),
  confidence: float("confidence"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TranscriptSegment = typeof transcriptSegments.$inferSelect;
export type InsertTranscriptSegment = typeof transcriptSegments.$inferInsert;

/**
 * Arguments - extracted arguments from speeches
 */
export const arguments_ = mysqlTable("arguments", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").references(() => debateSessions.id).notNull(),
  speechId: int("speechId").references(() => speeches.id).notNull(),
  team: mysqlEnum("team", ["government", "opposition"]).notNull(),
  type: mysqlEnum("type", ["argument", "rebuttal", "poi", "extension"]).notNull(),
  claim: text("claim").notNull(),
  mechanism: text("mechanism"),
  impact: text("impact"),
  transcriptExcerpt: text("transcriptExcerpt"),
  qualityScore: float("qualityScore"),
  strengthExplanation: text("strengthExplanation"),
  weaknessExplanation: text("weaknessExplanation"),
  wasAnswered: boolean("wasAnswered").default(false),
  answeredById: int("answeredById"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Argument = typeof arguments_.$inferSelect;
export type InsertArgument = typeof arguments_.$inferInsert;

/**
 * Argument relationships - links between arguments (supports, rebuts, clashes)
 */
export const argumentRelationships = mysqlTable("argument_relationships", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").references(() => debateSessions.id).notNull(),
  sourceArgumentId: int("sourceArgumentId").references(() => arguments_.id).notNull(),
  targetArgumentId: int("targetArgumentId").references(() => arguments_.id).notNull(),
  relationshipType: mysqlEnum("relationshipType", ["supports", "rebuts", "clashes", "extends"]).notNull(),
  strength: float("strength"), // 0-1 scale
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ArgumentRelationship = typeof argumentRelationships.$inferSelect;
export type InsertArgumentRelationship = typeof argumentRelationships.$inferInsert;

/**
 * Points of Information - POI records during debate
 */
export const pointsOfInformation = mysqlTable("points_of_information", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").references(() => debateSessions.id).notNull(),
  offeredById: int("offeredById").references(() => debateParticipants.id).notNull(),
  targetSpeechId: int("targetSpeechId").references(() => speeches.id).notNull(),
  wasAccepted: boolean("wasAccepted").default(false).notNull(),
  content: text("content"),
  timestamp: float("timestamp"), // seconds into the speech
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PointOfInformation = typeof pointsOfInformation.$inferSelect;
export type InsertPointOfInformation = typeof pointsOfInformation.$inferInsert;

/**
 * Rule violations - detected rule violations during debate
 */
export const ruleViolations = mysqlTable("rule_violations", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").references(() => debateSessions.id).notNull(),
  speechId: int("speechId").references(() => speeches.id),
  participantId: int("participantId").references(() => debateParticipants.id),
  violationType: mysqlEnum("violationType", ["new_argument_in_reply", "time_exceeded", "poi_during_protected", "speaking_out_of_turn"]).notNull(),
  description: text("description"),
  severity: mysqlEnum("severity", ["minor", "moderate", "major"]).default("minor").notNull(),
  timestamp: float("timestamp"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type RuleViolation = typeof ruleViolations.$inferSelect;
export type InsertRuleViolation = typeof ruleViolations.$inferInsert;

/**
 * Debate feedback - AI-generated post-debate feedback
 */
export const debateFeedback = mysqlTable("debate_feedback", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").references(() => debateSessions.id).notNull(),
  participantId: int("participantId").references(() => debateParticipants.id),
  feedbackType: mysqlEnum("feedbackType", ["individual", "team", "session"]).notNull(),
  summary: text("summary"),
  strongestArguments: json("strongestArguments").$type<string[]>(),
  missedResponses: json("missedResponses").$type<string[]>(),
  improvementSuggestions: json("improvementSuggestions").$type<{ area: string; suggestion: string }[]>(),
  mainClashes: json("mainClashes").$type<{ topic: string; governmentPosition: string; oppositionPosition: string; winner: string }[]>(),
  overallScore: float("overallScore"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DebateFeedback = typeof debateFeedback.$inferSelect;
export type InsertDebateFeedback = typeof debateFeedback.$inferInsert;

/**
 * User metrics - tracked performance metrics over time
 */
export const userMetrics = mysqlTable("user_metrics", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id).notNull(),
  sessionId: int("sessionId").references(() => debateSessions.id).notNull(),
  responsivenessScore: float("responsivenessScore"), // How well they respond to opponent arguments
  rebuttalQuality: float("rebuttalQuality"),
  argumentCompleteness: float("argumentCompleteness"), // claim-mechanism-impact
  weighingUsage: float("weighingUsage"),
  roleFulfillment: float("roleFulfillment"),
  overallPerformance: float("overallPerformance"),
  speakerRole: mysqlEnum("speakerRole", ["pm", "dpm", "gw", "lo", "dlo", "ow", "pmr", "lor"]),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UserMetric = typeof userMetrics.$inferSelect;
export type InsertUserMetric = typeof userMetrics.$inferInsert;
