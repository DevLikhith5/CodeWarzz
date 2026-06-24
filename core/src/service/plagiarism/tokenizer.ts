export type Language = 'cpp' | 'python' | 'javascript' | 'java' | 'go' | 'rust';

const COMMENT_PATTERNS: Record<Language, RegExp[]> = {
    cpp: [
        /\/\/.*$/gm,
        /\/\*[\s\S]*?\*\//g,
    ],
    python: [
        /#.*$/gm,
        /"""[\s\S]*?"""/g,
        /'''[\s\S]*?'''/g,
    ],
    javascript: [
        /\/\/.*$/gm,
        /\/\*[\s\S]*?\*\//g,
    ],
    java: [
        /\/\/.*$/gm,
        /\/\*[\s\S]*?\*\//g,
    ],
    go: [
        /\/\/.*$/gm,
        /\/\*[\s\S]*?\*\//g,
    ],
    rust: [
        /\/\/.*$/gm,
        /\/\*[\s\S]*?\*\//g,
    ],
};

const STRING_PATTERN = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g;

// Memoize keyword sets per language. Building a Set with ~70 entries is
// cheap individually, but `normalizeCode` calls `getKeywords` once per
// identifier (potentially thousands of times per submission). Caching the
// Set drops allocations by 1000x on a 1000-token submission.
const KEYWORD_SETS: Record<Language, string[]> = {
    cpp: ['if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'return', 'void', 'int', 'long', 'float', 'double', 'char', 'bool', 'true', 'false', 'const', 'static', 'auto', 'class', 'struct', 'public', 'private', 'protected', 'virtual', 'override', 'template', 'typename', 'using', 'namespace', 'include', 'define', 'ifdef', 'ifndef', 'endif', 'new', 'delete', 'try', 'catch', 'throw', 'noexcept', 'nullptr', 'sizeof', 'typedef', 'enum', 'union', 'extern', 'register', 'volatile', 'inline', 'explicit', 'friend', 'mutable', 'operator'],
    python: ['if', 'elif', 'else', 'for', 'while', 'break', 'continue', 'return', 'def', 'class', 'import', 'from', 'as', 'with', 'try', 'except', 'finally', 'raise', 'pass', 'lambda', 'yield', 'assert', 'del', 'global', 'nonlocal', 'True', 'False', 'None', 'and', 'or', 'not', 'in', 'is', 'self'],
    javascript: ['if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'return', 'function', 'var', 'let', 'const', 'class', 'import', 'export', 'from', 'default', 'new', 'this', 'try', 'catch', 'finally', 'throw', 'async', 'await', 'yield', 'typeof', 'instanceof', 'in', 'of', 'true', 'false', 'null', 'undefined', 'void', 'delete', 'super', 'extends', 'static', 'get', 'set'],
    java: ['if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'return', 'void', 'int', 'long', 'float', 'double', 'char', 'boolean', 'true', 'false', 'class', 'interface', 'extends', 'implements', 'new', 'this', 'super', 'try', 'catch', 'finally', 'throw', 'throws', 'public', 'private', 'protected', 'static', 'final', 'abstract', 'synchronized', 'volatile', 'transient', 'native', 'strictfp', 'import', 'package', 'instanceof', 'assert', 'enum', 'null'],
    go: ['if', 'else', 'for', 'range', 'switch', 'case', 'break', 'continue', 'return', 'func', 'var', 'const', 'type', 'struct', 'interface', 'map', 'chan', 'go', 'defer', 'select', 'package', 'import', 'nil', 'true', 'false', 'iota', 'make', 'new', 'append', 'len', 'cap', 'close', 'delete', 'copy', 'panic', 'recover'],
    rust: ['if', 'else', 'for', 'while', 'loop', 'match', 'break', 'continue', 'return', 'fn', 'let', 'mut', 'const', 'static', 'struct', 'enum', 'impl', 'trait', 'pub', 'use', 'mod', 'crate', 'self', 'super', 'where', 'type', 'as', 'in', 'ref', 'move', 'async', 'await', 'true', 'false', 'Some', 'None', 'Ok', 'Err', 'Box', 'Vec', 'String', 'str', 'i32', 'i64', 'u32', 'u64', 'f32', 'f64', 'bool', 'char', 'usize', 'isize'],
};

const KEYWORD_SET_CACHE: Partial<Record<Language, Set<string>>> = {};

function getKeywords(language: Language): Set<string> {
    let set = KEYWORD_SET_CACHE[language];
    if (!set) {
        set = new Set(KEYWORD_SETS[language]);
        KEYWORD_SET_CACHE[language] = set;
    }
    return set;
}

export function normalizeCode(code: string, language: Language): string {
    let normalized = code;

    for (const pattern of COMMENT_PATTERNS[language]) {
        normalized = normalized.replace(pattern, ' ');
    }

    normalized = normalized.replace(STRING_PATTERN, '"STR"');
    normalized = normalized.replace(/\b\d+\b/g, 'NUM');

    const keywords = getKeywords(language);
    const identifierMap = new Map<string, string>();
    let idCounter = 0;

    normalized = normalized.replace(/\b[a-zA-Z_]\w*\b/g, (match) => {
        if (keywords.has(match)) return match;
        let replacement = identifierMap.get(match);
        if (!replacement) {
            replacement = `ID_${idCounter++}`;
            identifierMap.set(match, replacement);
        }
        return replacement;
    });

    normalized = normalized.replace(/\s+/g, ' ').trim();

    return normalized;
}
