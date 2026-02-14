export const docxSkillDescription =
  "DOCX document skill. Convert Word documents to Markdown or images, and apply structured modifications. Use this skill when working with .docx files.";

export const docxSkillInstructions = `# DOCX Skill

You have access to tools for reading and modifying Word (.docx) documents.

## Recommended Workflow

1. **DocxToMarkdown** — Convert the DOCX to Markdown with element IDs (\`<!-- p_123 -->\`).
   Read the Markdown to understand the document structure and content.

2. **(Optional) DocxToImages** — Convert all pages to PNG images.
   Use this when visual layout matters (tables, charts, formatting).

3. **Gather information** — Analyze the Markdown (and images if needed) to determine
   what changes are required.

4. **Build modifications** — Write a JSON array of modifications referencing element IDs
   from the Markdown output.

5. **ModifyDocxWithJson** — Apply the modifications to produce a new DOCX file.

## Available Tools

### DocxToMarkdown

Converts a DOCX file to Markdown. The output includes element ID comments
(\`<!-- p_123 -->\`) that can be referenced in modifications.

### DocxToImages

Converts all pages of a DOCX file to PNG images. Useful for understanding
visual layout, tables, and formatting that may not be captured in Markdown.

### ModifyDocxWithJson

Applies a JSON array of modifications to a DOCX file. Each modification
references an element ID and specifies an action (replace, delete, insertAfter, insertBefore).

## Guidelines

- Always start with DocxToMarkdown to understand the document structure.
- Use element IDs from the Markdown output when building modifications.
- Prefer replace over delete + insertAfter for simple text changes.
- Review the Markdown output carefully before making modifications.`;
