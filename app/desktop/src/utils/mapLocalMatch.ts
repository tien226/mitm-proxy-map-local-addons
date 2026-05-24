import { getFlowUrl } from "./flow";
import type { MapLocalRule, MitmFlow } from "../types";

function getQueryParamsMap(url: URL): Map<string, string[]> {
  const params = new Map<string, string[]>();
  url.searchParams.forEach((value, key) => {
    const existing = params.get(key) ?? [];
    existing.push(value);
    params.set(key, existing);
  });
  return params;
}

function areQueryParamsEqual(left: Map<string, string[]>, right: Map<string, string[]>): boolean {
  if (left.size !== right.size) {
    return false;
  }
  for (const [key, leftValues] of left) {
    const rightValues = right.get(key);
    if (!rightValues) {
      return false;
    }
    const sortedLeft = [...leftValues].sort().join("\0");
    const sortedRight = [...rightValues].sort().join("\0");
    if (sortedLeft !== sortedRight) {
      return false;
    }
  }
  return true;
}

export function isSameMapLocalUrl(ruleUrl: string, flowUrl: string): boolean {
  try {
    const ruleParsed = new URL(ruleUrl);
    const flowParsed = new URL(flowUrl);
    const rulePath = `${ruleParsed.origin}${ruleParsed.pathname}`;
    const flowPath = `${flowParsed.origin}${flowParsed.pathname}`;
    if (rulePath !== flowPath) {
      return false;
    }
    return areQueryParamsEqual(getQueryParamsMap(ruleParsed), getQueryParamsMap(flowParsed));
  } catch {
    return ruleUrl === flowUrl;
  }
}

export function isFlowCoveredByMapLocalRule(flow: MitmFlow, rule: MapLocalRule): boolean {
  if (rule.method !== flow.request.method) {
    return false;
  }
  return isSameMapLocalUrl(rule.url, getFlowUrl(flow));
}

export function isFlowMappedByRules(flow: MitmFlow, rules: MapLocalRule[]): boolean {
  return rules.some((rule) => isFlowCoveredByMapLocalRule(flow, rule));
}

export function isSameMapLocalRule(left: MapLocalRule, right: MapLocalRule): boolean {
  if (left.method !== right.method) {
    return false;
  }
  return isSameMapLocalUrl(left.url, right.url);
}

export function findMatchingRuleIndex(rules: MapLocalRule[], rule: MapLocalRule): number {
  return rules.findIndex((existing) => isSameMapLocalRule(existing, rule));
}
