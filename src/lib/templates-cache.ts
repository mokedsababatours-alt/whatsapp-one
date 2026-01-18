// =============================================================================
// Shared Templates Cache
// Used by both /api/templates and /api/messages/send-template routes
// =============================================================================

export interface TemplateComponent {
  type: string;
  format?: string;
  text?: string;
  example?: {
    header_text?: string[];
    body_text?: string[][];
  };
  buttons?: Array<{
    type: string;
    text: string;
    url?: string;
    phone_number?: string;
  }>;
}

export interface CachedTemplate {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  components?: TemplateComponent[];
}

interface MetaTemplatesResponse {
  data: Array<{
    id: string;
    name: string;
    language: string;
    status: string;
    category: string;
    components?: TemplateComponent[];
  }>;
}

interface MetaErrorResponse {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id: string;
  };
}

// =============================================================================
// Cache Storage
// =============================================================================

let templatesCache: {
  data: CachedTemplate[] | null;
  timestamp: number;
} = {
  data: null,
  timestamp: 0,
};

// Cache duration: 5 minutes
const CACHE_DURATION_MS = 5 * 60 * 1000;

const META_API_VERSION = "v24.0";
const META_API_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

// =============================================================================
// Cache Functions
// =============================================================================

/**
 * Check if cache is still valid
 */
export function isCacheValid(): boolean {
  return (
    templatesCache.data !== null &&
    Date.now() - templatesCache.timestamp < CACHE_DURATION_MS
  );
}

/**
 * Get cached templates
 */
export function getCachedTemplates(): CachedTemplate[] | null {
  return templatesCache.data;
}

/**
 * Get cache timestamp
 */
export function getCacheTimestamp(): number {
  return templatesCache.timestamp;
}

/**
 * Update the cache
 */
export function updateCache(templates: CachedTemplate[]): void {
  templatesCache = {
    data: templates,
    timestamp: Date.now(),
  };
}

/**
 * Fetch templates from Meta API and update cache
 */
export async function fetchAndCacheTemplates(): Promise<
  { success: true; data: CachedTemplate[] } | { success: false; error: MetaErrorResponse }
> {
  const accessToken = process.env.META_ACCESS_TOKEN;
  const wabaId = process.env.META_WABA_ID;

  if (!accessToken) {
    throw new Error("META_ACCESS_TOKEN environment variable not configured");
  }

  if (!wabaId) {
    throw new Error("META_WABA_ID environment variable is required for fetching templates");
  }

  const url = `${META_API_BASE_URL}/${wabaId}/message_templates?fields=id,name,language,status,category,components`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    return { success: false, error: data as MetaErrorResponse };
  }

  const templatesResponse = data as MetaTemplatesResponse;

  // Filter to only APPROVED templates
  const approvedTemplates: CachedTemplate[] = templatesResponse.data
    .filter((template) => template.status === "APPROVED")
    .map((template) => ({
      id: template.id,
      name: template.name,
      language: template.language,
      category: template.category,
      status: template.status,
      components: template.components,
    }));

  // Update cache
  updateCache(approvedTemplates);

  return { success: true, data: approvedTemplates };
}

/**
 * Get a specific template by name and language from cache or fetch
 */
export async function getTemplateByNameAndLanguage(
  templateName: string,
  languageCode: string
): Promise<CachedTemplate | null> {
  // Check cache first
  if (isCacheValid() && templatesCache.data) {
    const template = templatesCache.data.find(
      (t) => t.name === templateName && t.language === languageCode
    );
    if (template) {
      return template;
    }
  }

  // Fetch from API if cache miss
  const result = await fetchAndCacheTemplates();
  if (!result.success) {
    return null;
  }

  // Search in freshly fetched data
  return result.data?.find(
    (t) => t.name === templateName && t.language === languageCode
  ) || null;
}

/**
 * Extract the BODY component text from template components
 */
export function extractBodyText(components?: TemplateComponent[]): string | null {
  if (!components) return null;

  const bodyComponent = components.find(
    (c) => c.type === "BODY" || c.type === "body"
  );

  return bodyComponent?.text || null;
}

/**
 * Extract the HEADER component text from template components
 */
export function extractHeaderText(components?: TemplateComponent[]): string | null {
  if (!components) return null;

  const headerComponent = components.find(
    (c) => c.type === "HEADER" || c.type === "header"
  );

  // Only return text for TEXT format headers
  if (headerComponent?.format === "TEXT" || !headerComponent?.format) {
    return headerComponent?.text || null;
  }

  return null;
}

/**
 * Substitute placeholder parameters in template text
 * Template format: "Hello {{1}}, your order {{2}} is ready"
 * Parameters: ["John", "12345"]
 * Result: "Hello John, your order 12345 is ready"
 */
export function substituteParameters(
  text: string,
  parameters?: Array<{ type: string; text?: string }>
): string {
  if (!parameters || parameters.length === 0) {
    return text;
  }

  let result = text;

  parameters.forEach((param, index) => {
    const placeholder = `{{${index + 1}}}`;
    const value = param.text || `[${index + 1}]`;
    result = result.replace(placeholder, value);
  });

  return result;
}

/**
 * Build full display text for a template message
 * Combines header (if text) and body with parameter substitution
 */
export function buildTemplateDisplayText(
  template: CachedTemplate,
  headerParams?: Array<{ type: string; text?: string }>,
  bodyParams?: Array<{ type: string; text?: string }>
): string {
  const parts: string[] = [];

  // Add header text if present
  const headerText = extractHeaderText(template.components);
  if (headerText) {
    const substitutedHeader = substituteParameters(headerText, headerParams);
    parts.push(substitutedHeader);
  }

  // Add body text
  const bodyText = extractBodyText(template.components);
  if (bodyText) {
    const substitutedBody = substituteParameters(bodyText, bodyParams);
    parts.push(substitutedBody);
  }

  // If no text found, return template name as fallback
  if (parts.length === 0) {
    return `Template: ${template.name}`;
  }

  return parts.join("\n\n");
}
