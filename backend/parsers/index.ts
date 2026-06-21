import { GeminiResponse } from '../../shared/types';
import { parseFoodRules } from './parser';
import { callGemini } from '../services/gemini';
import { supabase } from '../services/supabaseClient';

/**
 * Orchestrates food parsing logic.
 * Tries direct rules matching first. If no rules match, delegates to Gemini.
 */
export async function parseFoodOrchestrator(normalizedText: string): Promise<GeminiResponse> {
  // 1. Try rule-based parser
  const ruleResult = await parseFoodRules(normalizedText);
  if (ruleResult) {
    console.log(`[Rule Parser Hit] key: "${normalizedText}"`);
    return ruleResult;
  }

  // 2. Call Gemini
  console.log(`[LLM Parser Request] key: "${normalizedText}"`);
  const geminiResult = await callGemini(normalizedText);

  return geminiResult;
}
