CREATE TABLE `argument_relationships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`sourceArgumentId` int NOT NULL,
	`targetArgumentId` int NOT NULL,
	`relationshipType` enum('supports','rebuts','clashes','extends') NOT NULL,
	`strength` float,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `argument_relationships_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `arguments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`speechId` int NOT NULL,
	`team` enum('government','opposition') NOT NULL,
	`type` enum('argument','rebuttal','poi','extension') NOT NULL,
	`claim` text NOT NULL,
	`mechanism` text,
	`impact` text,
	`transcriptExcerpt` text,
	`qualityScore` float,
	`strengthExplanation` text,
	`weaknessExplanation` text,
	`wasAnswered` boolean DEFAULT false,
	`answeredById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `arguments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `debate_feedback` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`participantId` int,
	`feedbackType` enum('individual','team','session') NOT NULL,
	`summary` text,
	`strongestArguments` json,
	`missedResponses` json,
	`improvementSuggestions` json,
	`mainClashes` json,
	`overallScore` float,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `debate_feedback_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `debate_participants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`userId` int NOT NULL,
	`team` enum('government','opposition') NOT NULL,
	`speakerRole` enum('pm','dpm','gw','lo','dlo','ow','pmr','lor') NOT NULL,
	`isConnected` boolean NOT NULL DEFAULT false,
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `debate_participants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `debate_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomCode` varchar(8) NOT NULL,
	`motionId` int,
	`status` enum('waiting','in_progress','completed','cancelled') NOT NULL DEFAULT 'waiting',
	`format` enum('asian_parliamentary','british_parliamentary','world_schools') NOT NULL DEFAULT 'asian_parliamentary',
	`currentSpeakerIndex` int NOT NULL DEFAULT 0,
	`currentSpeakerStartTime` timestamp,
	`createdBy` int,
	`startedAt` timestamp,
	`endedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `debate_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `debate_sessions_roomCode_unique` UNIQUE(`roomCode`)
);
--> statement-breakpoint
CREATE TABLE `motions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` text NOT NULL,
	`topic` enum('politics','ethics','technology','economics','social','environment','education','health') NOT NULL,
	`difficulty` enum('novice','intermediate','advanced') NOT NULL,
	`format` enum('asian_parliamentary','british_parliamentary','world_schools') NOT NULL DEFAULT 'asian_parliamentary',
	`backgroundContext` text,
	`stakeholders` json,
	`createdBy` int,
	`isAiGenerated` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `motions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `points_of_information` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`offeredById` int NOT NULL,
	`targetSpeechId` int NOT NULL,
	`wasAccepted` boolean NOT NULL DEFAULT false,
	`content` text,
	`timestamp` float,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `points_of_information_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rule_violations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`speechId` int,
	`participantId` int,
	`violationType` enum('new_argument_in_reply','time_exceeded','poi_during_protected','speaking_out_of_turn') NOT NULL,
	`description` text,
	`severity` enum('minor','moderate','major') NOT NULL DEFAULT 'minor',
	`timestamp` float,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rule_violations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `speeches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`participantId` int NOT NULL,
	`speakerRole` enum('pm','dpm','gw','lo','dlo','ow','pmr','lor') NOT NULL,
	`transcript` text,
	`audioUrl` varchar(512),
	`duration` int,
	`startedAt` timestamp,
	`endedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `speeches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transcript_segments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`speechId` int NOT NULL,
	`text` text NOT NULL,
	`startTime` float NOT NULL,
	`endTime` float NOT NULL,
	`confidence` float,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `transcript_segments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_metrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`sessionId` int NOT NULL,
	`responsivenessScore` float,
	`rebuttalQuality` float,
	`argumentCompleteness` float,
	`weighingUsage` float,
	`roleFulfillment` float,
	`overallPerformance` float,
	`speakerRole` enum('pm','dpm','gw','lo','dlo','ow','pmr','lor'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_metrics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `argument_relationships` ADD CONSTRAINT `argument_relationships_sessionId_debate_sessions_id_fk` FOREIGN KEY (`sessionId`) REFERENCES `debate_sessions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `argument_relationships` ADD CONSTRAINT `argument_relationships_sourceArgumentId_arguments_id_fk` FOREIGN KEY (`sourceArgumentId`) REFERENCES `arguments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `argument_relationships` ADD CONSTRAINT `argument_relationships_targetArgumentId_arguments_id_fk` FOREIGN KEY (`targetArgumentId`) REFERENCES `arguments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `arguments` ADD CONSTRAINT `arguments_sessionId_debate_sessions_id_fk` FOREIGN KEY (`sessionId`) REFERENCES `debate_sessions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `arguments` ADD CONSTRAINT `arguments_speechId_speeches_id_fk` FOREIGN KEY (`speechId`) REFERENCES `speeches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `debate_feedback` ADD CONSTRAINT `debate_feedback_sessionId_debate_sessions_id_fk` FOREIGN KEY (`sessionId`) REFERENCES `debate_sessions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `debate_feedback` ADD CONSTRAINT `debate_feedback_participantId_debate_participants_id_fk` FOREIGN KEY (`participantId`) REFERENCES `debate_participants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `debate_participants` ADD CONSTRAINT `debate_participants_sessionId_debate_sessions_id_fk` FOREIGN KEY (`sessionId`) REFERENCES `debate_sessions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `debate_participants` ADD CONSTRAINT `debate_participants_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `debate_sessions` ADD CONSTRAINT `debate_sessions_motionId_motions_id_fk` FOREIGN KEY (`motionId`) REFERENCES `motions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `debate_sessions` ADD CONSTRAINT `debate_sessions_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `motions` ADD CONSTRAINT `motions_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `points_of_information` ADD CONSTRAINT `points_of_information_sessionId_debate_sessions_id_fk` FOREIGN KEY (`sessionId`) REFERENCES `debate_sessions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `points_of_information` ADD CONSTRAINT `points_of_information_offeredById_debate_participants_id_fk` FOREIGN KEY (`offeredById`) REFERENCES `debate_participants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `points_of_information` ADD CONSTRAINT `points_of_information_targetSpeechId_speeches_id_fk` FOREIGN KEY (`targetSpeechId`) REFERENCES `speeches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rule_violations` ADD CONSTRAINT `rule_violations_sessionId_debate_sessions_id_fk` FOREIGN KEY (`sessionId`) REFERENCES `debate_sessions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rule_violations` ADD CONSTRAINT `rule_violations_speechId_speeches_id_fk` FOREIGN KEY (`speechId`) REFERENCES `speeches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rule_violations` ADD CONSTRAINT `rule_violations_participantId_debate_participants_id_fk` FOREIGN KEY (`participantId`) REFERENCES `debate_participants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `speeches` ADD CONSTRAINT `speeches_sessionId_debate_sessions_id_fk` FOREIGN KEY (`sessionId`) REFERENCES `debate_sessions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `speeches` ADD CONSTRAINT `speeches_participantId_debate_participants_id_fk` FOREIGN KEY (`participantId`) REFERENCES `debate_participants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transcript_segments` ADD CONSTRAINT `transcript_segments_speechId_speeches_id_fk` FOREIGN KEY (`speechId`) REFERENCES `speeches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_metrics` ADD CONSTRAINT `user_metrics_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_metrics` ADD CONSTRAINT `user_metrics_sessionId_debate_sessions_id_fk` FOREIGN KEY (`sessionId`) REFERENCES `debate_sessions`(`id`) ON DELETE no action ON UPDATE no action;