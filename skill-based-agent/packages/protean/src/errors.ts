export type AppErrorCode =
  | "UNKNOWN_SKILL"
  | "DEPENDENCY_RESOLUTION"
  | "TOOL_COLLISION"
  | "INVALID_TOOL_INPUT";

export abstract class AppError extends Error {
  readonly code: AppErrorCode;

  protected constructor(code: AppErrorCode, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

export class UnknownSkillError extends AppError {
  readonly skillId: string;

  constructor(skillId: string, availableSkillIds: string[]) {
    super(
      "UNKNOWN_SKILL",
      `Unknown skill "${skillId}". Available skills: ${availableSkillIds.join(", ")}`,
    );
    this.skillId = skillId;
  }
}

export class DependencyResolutionError extends AppError {
  readonly skillId: string;

  constructor(skillId: string, reason: string) {
    super(
      "DEPENDENCY_RESOLUTION",
      `Failed to resolve dependencies for "${skillId}": ${reason}`,
    );
    this.skillId = skillId;
  }
}

export class ToolCollisionError extends AppError {
  readonly toolName: string;

  constructor(toolName: string) {
    super(
      "TOOL_COLLISION",
      `Tool name collision: "${toolName}" is defined by multiple skills.`,
    );
    this.toolName = toolName;
  }
}

export class InvalidToolInputError extends AppError {
  readonly context: string;

  constructor(context: string, reason: string) {
    super("INVALID_TOOL_INPUT", `Invalid input for ${context}: ${reason}`);
    this.context = context;
  }
}
