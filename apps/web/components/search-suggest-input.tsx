"use client";

import { useEffect, useRef, useState } from "react";
import { buildApiUrl, withQuery } from "../lib/api-core";

// Styles
import styles from "../styles/components/search-suggest-input.module.css";

export type SearchSuggestion = {
  id: string;
  title: string;
  entityType: string;
  slug: string;
};

type SearchSuggestInputProps = {
  name?: string;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  type?: string;
  minChars?: number;
  inputClassName?: string;
  onValueChange?: (value: string) => void;
  onSelect?: (item: SearchSuggestion) => void;
  getSuggestions?: (query: string, signal: AbortSignal) => Promise<SearchSuggestion[]>;
  maxSuggestions?: number;
  disabled?: boolean;
  allowEmpty?: boolean;
  shouldSearch?: (value: string) => boolean;
};

export function SearchSuggestInput({
  name,
  value,
  defaultValue,
  placeholder,
  type,
  minChars = 0,
  inputClassName,
  onValueChange,
  onSelect,
  getSuggestions,
  maxSuggestions = 6,
  disabled = false,
  allowEmpty = false,
  shouldSearch
}: SearchSuggestInputProps) {
  const [localValue, setLocalValue] = useState(defaultValue ?? "");
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<number | null>(null);
  const currentValue = value ?? localValue;

  const updateValue = (nextValue: string) => {
    if (value === undefined) {
      setLocalValue(nextValue);
    }
    onValueChange?.(nextValue);
  };

  useEffect(() => {
    if (disabled) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    const trimmed = currentValue.trim();
    const defaultCanSearch = allowEmpty
      ? trimmed.length >= minChars
      : trimmed.length > 0 && trimmed.length >= minChars;
    const canSearch = shouldSearch ? shouldSearch(currentValue) : defaultCanSearch;
    if (!canSearch) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    setOpen(true);
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }

    debounceRef.current = window.setTimeout(async () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }

      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);

      try {
        const data = getSuggestions
          ? await getSuggestions(currentValue, controller.signal)
          : await (async () => {
              const path = withQuery("/search", { q: currentValue, type });
              const response = await fetch(buildApiUrl(path), { signal: controller.signal });
              if (!response.ok) {
                throw new Error("search failed");
              }
              return (await response.json()) as SearchSuggestion[];
            })();
        setSuggestions(data.slice(0, maxSuggestions));
      } catch (error) {
        if ((error as { name?: string }).name !== "AbortError") {
          setSuggestions([]);
        }
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, [currentValue, minChars, type, getSuggestions, maxSuggestions, disabled, allowEmpty]);

  return (
    <div className={styles.shell}>
      <input
        className={inputClassName ?? styles.input}
        type="search"
        name={name}
        value={currentValue}
        placeholder={placeholder}
        autoComplete="off"
        disabled={disabled}
        onFocus={() => {
          setOpen(true);
        }}
        onBlur={() => {
          setOpen(false);
        }}
        onChange={(event) => {
          updateValue(event.target.value);
        }}
      />
      {open ? (
        <div className={styles.panel} onMouseDown={(event) => event.preventDefault()}>
          {loading ? <div className={`${styles.item} ${styles.itemMuted}`}>正在检索...</div> : null}
          {!loading && suggestions.length === 0 ? (
            <div className={`${styles.item} ${styles.itemMuted}`}>暂无匹配建议</div>
          ) : null}
          {!loading
              ? suggestions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={styles.item}
                  onClick={() => {
                    updateValue(item.title);
                    onSelect?.(item);
                    setOpen(false);
                  }}
                >
                  {item.title}
                </button>
              ))
            : null}
        </div>
      ) : null}
    </div>
  );
}
