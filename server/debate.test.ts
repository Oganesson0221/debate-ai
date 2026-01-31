import { describe, expect, it, beforeEach, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the database module
vi.mock("./db", () => ({
  createMotion: vi.fn().mockResolvedValue(1),
  getMotionById: vi.fn().mockResolvedValue({
    id: 1,
    title: "This House believes that AI will benefit humanity",
    topic: "technology",
    difficulty: "intermediate",
    format: "asian_parliamentary",
    backgroundContext: "AI is rapidly advancing...",
    stakeholders: ["tech companies", "workers", "governments"],
    isAiGenerated: true,
    createdAt: new Date(),
  }),
  createDebateSession: vi.fn().mockResolvedValue({ id: 1, roomCode: 'TESTROOM' }),
  getDebateSessionById: vi.fn().mockResolvedValue({
    id: 1,
    roomCode: "TESTROOM",
    motionId: 1,
    status: "waiting",
    format: "asian_parliamentary",
    currentSpeakerIndex: 0,
    createdBy: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  getDebateSessionByRoomCode: vi.fn().mockResolvedValue({
    id: 1,
    roomCode: "TESTROOM",
    motionId: 1,
    status: "waiting",
    format: "asian_parliamentary",
    currentSpeakerIndex: 0,
    createdBy: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  getDebateSessionWithDetails: vi.fn().mockResolvedValue({
    session: {
      id: 1,
      roomCode: "TESTROOM",
      motionId: 1,
      status: "waiting",
      format: "asian_parliamentary",
      currentSpeakerIndex: 0,
      createdBy: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    motion: {
      id: 1,
      title: "This House believes that AI will benefit humanity",
      topic: "technology",
      difficulty: "intermediate",
    },
    participants: [],
    speeches: [],
    arguments: [],
    relationships: [],
    pois: [],
    violations: [],
    feedback: [],
    metrics: [],
  }),
  addDebateParticipant: vi.fn().mockResolvedValue({ id: 1 }),
  getSessionParticipants: vi.fn().mockResolvedValue([]),
  updateDebateSession: vi.fn().mockResolvedValue(undefined),
  getUserDebateSessions: vi.fn().mockResolvedValue([]),
  getUserProgressStats: vi.fn().mockResolvedValue({
    avgResponsiveness: 0.75,
    avgRebuttalQuality: 0.8,
    avgArgumentCompleteness: 0.7,
    avgWeighingUsage: 0.65,
    avgRoleFulfillment: 0.85,
    avgOverallPerformance: 0.75,
    totalDebates: 5,
  }),
  getSessionArguments: vi.fn().mockResolvedValue([]),
  getSessionArgumentRelationships: vi.fn().mockResolvedValue([]),
}));

// Mock the LLM module
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          title: "This House believes that AI will benefit humanity",
          backgroundContext: "AI is rapidly advancing and transforming industries.",
          stakeholders: ["tech companies", "workers", "governments"]
        })
      }
    }]
  })
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("Motion Router", () => {
  it("creates a custom motion", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.motion.create({
      title: "This House believes that social media does more harm than good",
      topic: "social",
      difficulty: "intermediate",
      format: "asian_parliamentary",
    });

    expect(result).toBeDefined();
    expect(result.id).toBe(1);
  });

  it("gets a motion by ID", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.motion.get({ id: 1 });

    expect(result).toBeDefined();
    expect(result?.title).toBe("This House believes that AI will benefit humanity");
    expect(result?.topic).toBe("technology");
  });
});

describe("Debate Router", () => {
  it("creates a debate session", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.debate.create({
      motionId: 1,
      format: "asian_parliamentary",
    });

    expect(result).toBeDefined();
    expect(result).toHaveProperty('roomCode');
    expect(result.roomCode).toHaveLength(8);
    expect(result).toHaveProperty('id', 1);
  });

  it("gets a debate session by room code", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.debate.getByRoomCode({ roomCode: "TESTROOM" });

    expect(result).toBeDefined();
    expect(result?.session.roomCode).toBe("TESTROOM");
    expect(result?.session.status).toBe("waiting");
  });

  it("gets user's debate sessions", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.debate.myDebates();

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("Metrics Router", () => {
  it("gets user metrics", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.metrics.get();

    expect(result).toBeDefined();
    expect(result?.avgResponsiveness).toBe(0.75);
    expect(result?.avgRebuttalQuality).toBe(0.8);
    expect(result?.totalDebates).toBe(5);
  });
});

describe("Argument Router", () => {
  it("lists arguments for a session", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.argument.list({ sessionId: 1 });

    expect(result).toBeDefined();
    expect(result.arguments).toBeDefined();
    expect(result.relationships).toBeDefined();
  });
});
