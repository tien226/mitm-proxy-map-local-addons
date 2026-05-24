"""Match Map Local rules by method and URL (same logic as map-local-addons)."""

from typing import List, Protocol
from urllib.parse import parse_qs, urljoin, urlparse


class RuleLike(Protocol):
    method: str
    url: str


def is_same_map_local_url(rule_url: str, other_url: str) -> bool:
    parsed_lhs = urlparse(rule_url)
    lhs_query_params = parse_qs(parsed_lhs.query)
    parsed_rhs = urlparse(other_url)
    rhs_query_params = parse_qs(parsed_rhs.query)
    lhs_path_url = urljoin(rule_url, parsed_lhs.path)
    rhs_path_url = urljoin(rule_url, parsed_rhs.path)
    if lhs_path_url != rhs_path_url:
        return False
    lhs_keys = list(lhs_query_params.keys())
    rhs_keys = list(rhs_query_params.keys())
    if len(lhs_keys) != len(rhs_keys):
        return False
    for key in lhs_keys:
        if lhs_query_params[key] != rhs_query_params[key]:
            return False
    for key in rhs_keys:
        if lhs_query_params.get(key) != rhs_query_params.get(key):
            return False
    return True


def is_same_map_local_rule(left: RuleLike, right: RuleLike) -> bool:
    if left.method != right.method:
        return False
    return is_same_map_local_url(left.url, right.url)


def find_matching_rule_indices(rules: List[RuleLike], rule: RuleLike) -> List[int]:
    indices: List[int] = []
    for index, existing in enumerate(rules):
        if is_same_map_local_rule(existing, rule):
            indices.append(index)
    return indices
