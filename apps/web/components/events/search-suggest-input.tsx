"use client";

import { useEffect, useRef, useState } from "react";
import { buildApiUrl, withQuery } from "../../lib/api-core";

// Styles
import styles from "../../styles/components/search-suggest-input.module.css";

type SearchSuggestion = {
  id: string;
  title: string;
  entityType: string;
  slug: string;
};

export function SearchSuggestInput({
  name,
  defaultValue,
  placeholder,
  type,
  minChars = 0,
  inputClassName
}: {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  type?: string;
  minChars?: number;
  inputClassName?: string;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!value.trim() || value.trim().length < minChars) {
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
        const path = withQuery("/search", { q: value, type });
        const response = await fetch(buildApiUrl(path), { signal: controller.signal });
        if (!response.ok) {
          throw new Error("search failed");
        }
        const data = (await response.json()) as SearchSuggestion[];
        setSuggestions(data.slice(0, 6));
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
  }, [value]);

  return (
    <div className={styles.shell}>
      <input
        className={inputClassName ?? styles.input}
        type="search"
        name={name}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => {
          setOpen(true);
        }}
        onBlur={() => {
          setOpen(false);
        }}
        onChange={(event) => {
          setValue(event.target.value);
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
                    setValue(item.title);
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
