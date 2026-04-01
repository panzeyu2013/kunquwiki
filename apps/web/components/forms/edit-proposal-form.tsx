"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createQuickEntityClient, getEditorOptions, getEntityPublic, submitCreateProposal, submitProposal } from "../../lib/api-client";
import { getEntityDetailPath } from "../../lib/routes";
import { ActionBar } from "../action-bar";
import type { WorkType } from "@kunquwiki/shared";
import {
  CollapsibleFormSection,
  EditorSummaryBar,
  makeClientKey,
  removeAt,
  updateAt,
  type EditableEntity,
  type EditorOptions,
  type EntityOption,
  type EventProgramItemRow,
  type PersonIdentityRow,
  type QuickCreatedOption,
  type TroupeMembershipRow
} from "./edit-proposal/shared";
import { ArticleFields } from "./edit-proposal/types/article-fields";
import { CityFields } from "./edit-proposal/types/city-fields";
import { EventFields } from "./edit-proposal/types/event-fields";
import { PersonFields } from "./edit-proposal/types/person-fields";
import { TroupeFields } from "./edit-proposal/types/troupe-fields";
import { VenueFields } from "./edit-proposal/types/venue-fields";
import { WorkFields } from "./edit-proposal/types/work-fields";

// Styles
import styles from "../../styles/editor-page.module.css";

function emptyState(entityType: string) {
  const base: Record<string, unknown> = {
    representativeWorkIds: [],
    representativeExcerptIds: [],
    coverImageId: ""
  };

  switch (entityType) {
    case "work":
      return {
        ...base,
        workType: "full_play",
        originalAuthor: "",
        dynastyPeriod: "",
        genreNote: "",
        parentWorkId: "",
        excerptName: "",
        durationMinutes: "",
        firstKnownDate: "",
      };
    case "person":
      return {
        ...base,
        personTypeNote: "",
        gender: "",
        birthDate: "",
        deathDate: "",
        birthCityId: "",
        isLiving: null,
        personIdentities: [] as PersonIdentityRow[],
        troupeMemberships: [] as TroupeMembershipRow[]
      };
    case "troupe":
      return {
        ...base,
        troupeType: "troupe",
        foundedDate: "",
        dissolvedDate: "",
        cityId: "",
        cityText: "",
        regionText: "",
        officialWebsite: ""
      };
    case "venue":
      return {
        ...base,
        venueType: "theater",
        countryText: "中国",
        cityId: "",
        cityText: "",
        regionText: "",
        address: "",
        latitude: "",
        longitude: "",
        capacity: ""
      };
    case "event":
      return {
        ...base,
        eventType: "performance",
        businessStatus: "scheduled",
        startAt: "",
        endAt: "",
        cityId: "",
        venueEntityId: "",
        troupeIds: [] as string[],
        ticketUrl: "",
        duration: "",
        ticketStatus: "",
        noteText: "",
        posterImageId: "",
        programDetailed: [] as EventProgramItemRow[]
      };
    case "city":
      return {
        ...base,
        province: ""
      };
    case "article":
      return {
        ...base,
        articleType: "term",
        abstract: "",
        difficultyLevel: "",
        bodySourceType: ""
      };
    default:
      return base;
  }
}

function entityPath(entityType: string, slug: string) {
  return getEntityDetailPath(entityType, slug);
}

function buildEventTitle(input: {
  startAt: string;
  cityTitle?: string;
  venueTitle?: string;
  troupeTitles: string[];
  workTitles: string[];
  excerptTitles: string[];
}) {
  const dateLabel = input.startAt ? input.startAt.slice(0, 10) : "待定日期";
  const locationLabel = input.cityTitle || input.venueTitle || "待定地点";
  const troupeLabel =
    input.troupeTitles.length === 0 ? "未命名剧团" : input.troupeTitles.length === 1 ? input.troupeTitles[0] : `${input.troupeTitles[0]}等`;
  const programTitles = [...input.workTitles, ...input.excerptTitles];
  const programLabel =
    programTitles.length === 0 ? "昆曲演出" : programTitles.length === 1 ? `《${programTitles[0]}》演出` : `《${programTitles[0]}》等演出`;
  return `${dateLabel} ${locationLabel} ${troupeLabel} ${programLabel}`;
}

export function EditProposalForm({ slug, entityType }: { slug?: string; entityType?: string }) {
  const [entity, setEntity] = useState<EditableEntity | null>(null);
  const [options, setOptions] = useState<EditorOptions | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [formState, setFormState] = useState<Record<string, unknown>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [draftEntityIds, setDraftEntityIds] = useState<string[]>([]);

  const activeEntityType = entity?.entityType ?? entityType ?? "";
  const isCreateMode = !slug;

  function setField(name: string, value: unknown) {
    setFormState((current) => ({ ...current, [name]: value }));
  }

  function setArrayField(name: string, values: string[]) {
    setFormState((current) => ({ ...current, [name]: values }));
  }

  function toggleArrayField(name: string, value: string) {
    setFormState((current) => {
      const previous = Array.isArray(current[name]) ? (current[name] as string[]) : [];
      return {
        ...current,
        [name]: previous.includes(value) ? previous.filter((item) => item !== value) : [...previous, value]
      };
    });
  }

  function appendStructuredRow<T>(name: string, row: T) {
    setFormState((current) => {
      const previous = Array.isArray(current[name]) ? (current[name] as T[]) : [];
      return {
        ...current,
        [name]: [...previous, row]
      };
    });
  }

  function updateStructuredRow<T extends { key: string }>(name: string, key: string, updater: (row: T) => T) {
    setFormState((current) => {
      const previous = Array.isArray(current[name]) ? (current[name] as T[]) : [];
      return {
        ...current,
        [name]: updateAt(previous, key, updater)
      };
    });
  }

  function removeStructuredRow<T extends { key: string }>(name: string, key: string) {
    setFormState((current) => {
      const previous = Array.isArray(current[name]) ? (current[name] as T[]) : [];
      return {
        ...current,
        [name]: removeAt(previous, key)
      };
    });
  }

  function isDraftEntity(id: string) {
    return draftEntityIds.includes(id);
  }

  async function createQuickOption(
    nextEntityType: string,
    name: string,
    targetList: keyof NonNullable<EditorOptions>,
    extra?: { workType?: WorkType; parentWorkId?: string; initialData?: Record<string, unknown> }
  ) {
    const created = await createQuickEntityClient({
      entityType: nextEntityType,
      title: name,
      workType: extra?.workType,
      parentWorkId: extra?.parentWorkId,
      initialData: extra?.initialData
    });

    setDraftEntityIds((current) => (current.includes(created.id) ? current : [...current, created.id]));
    setOptions((current) => {
      if (!current) {
        return current;
      }
      const list = current[targetList] as unknown;
      if (!Array.isArray(list) || list.some((item) => !item || typeof item !== "object" || !("title" in item))) {
        return current;
      }
      const optionList = list as EntityOption[];
      if (optionList.some((item) => item.id === created.id)) {
        return current;
      }
      return {
        ...current,
        [targetList]: [...optionList, created].sort((a, b) => a.title.localeCompare(b.title, "zh-CN"))
      };
    });

    return created;
  }

  useEffect(() => {
    let active = true;

    async function loadCreateState() {
      if (!entityType) {
        setLoaded(true);
        return;
      }
      const nextOptions = await getEditorOptions(entityType);
      if (!active) {
        return;
      }
      setFormState(emptyState(entityType));
      setOptions(nextOptions);
      setLoaded(true);
    }

    async function loadEditState() {
      const loadedEntity = await getEntityPublic(slug!);
      if (!active || !loadedEntity) {
        return;
      }
      setEntity(loadedEntity);
      setTitle(loadedEntity.title);
      setBody(loadedEntity.body ?? "");

      const nextState = emptyState(loadedEntity.entityType);
      nextState.coverImageId = loadedEntity.coverImageId ?? "";
      switch (loadedEntity.entityType) {
        case "work":
          nextState.workType = loadedEntity.workType ?? "full_play";
          nextState.originalAuthor = loadedEntity.originalAuthor ?? "";
          nextState.dynastyPeriod = loadedEntity.dynastyPeriod ?? "";
          nextState.genreNote = loadedEntity.genreNote ?? "";
          nextState.parentWorkId = loadedEntity.parentWorkId ?? "";
          nextState.excerptName =
            loadedEntity.workType === "excerpt" ? loadedEntity.title.split("·").slice(1).join("·") || loadedEntity.title : "";
          nextState.durationMinutes = loadedEntity.durationMinutes ? String(loadedEntity.durationMinutes) : "";
          nextState.firstKnownDate = loadedEntity.firstKnownDate ?? "";
          break;
        case "person":
          nextState.personTypeNote = loadedEntity.personTypeNote ?? "";
          nextState.gender = loadedEntity.gender ?? "";
          nextState.birthDate = loadedEntity.birthDate ? loadedEntity.birthDate.slice(0, 16) : "";
          nextState.deathDate = loadedEntity.deathDate ? loadedEntity.deathDate.slice(0, 16) : "";
          nextState.birthCityId = loadedEntity.birthCityId ?? "";
          nextState.isLiving = loadedEntity.isLiving ?? null;
          nextState.representativeWorkIds = loadedEntity.representativeWorkIds ?? [];
          nextState.representativeExcerptIds = loadedEntity.representativeExcerptIds ?? [];
          nextState.personIdentities =
            loadedEntity.personIdentities?.map((item) => ({
              key: makeClientKey("identity"),
              identityTerm: item.identityTerm ?? "",
              startDate: item.startDate ? item.startDate.slice(0, 16) : "",
              endDate: item.endDate ? item.endDate.slice(0, 16) : ""
            })) ?? [];
          nextState.troupeMemberships =
            loadedEntity.troupeMemberships?.map((item) => ({
              key: makeClientKey("membership"),
              troupeEntityId: item.troupeEntityId ?? "",
              membershipRole: item.membershipRole ?? "成员",
              startDate: item.startDate ? item.startDate.slice(0, 16) : "",
              endDate: item.endDate ? item.endDate.slice(0, 16) : "",
              isCurrent: item.isCurrent ?? false
            })) ?? [];
          break;
        case "troupe":
          nextState.troupeType = loadedEntity.troupeType ?? "troupe";
          nextState.foundedDate = loadedEntity.foundedDate ? loadedEntity.foundedDate.slice(0, 16) : "";
          nextState.dissolvedDate = loadedEntity.dissolvedDate ? loadedEntity.dissolvedDate.slice(0, 16) : "";
          nextState.cityId = loadedEntity.cityId ?? "";
          nextState.cityText = loadedEntity.cityText ?? "";
          nextState.regionText = loadedEntity.regionText ?? "";
          nextState.officialWebsite = loadedEntity.officialWebsite ?? "";
          break;
        case "venue":
          nextState.venueType = loadedEntity.venueType ?? "theater";
          nextState.countryText = loadedEntity.countryText ?? "中国";
          nextState.cityId = loadedEntity.cityId ?? "";
          nextState.cityText = loadedEntity.cityText ?? "";
          nextState.regionText = loadedEntity.regionText ?? "";
          nextState.address = loadedEntity.address ?? "";
          nextState.latitude = loadedEntity.latitude !== undefined ? String(loadedEntity.latitude) : "";
          nextState.longitude = loadedEntity.longitude !== undefined ? String(loadedEntity.longitude) : "";
          nextState.capacity = loadedEntity.capacity !== undefined ? String(loadedEntity.capacity) : "";
          break;
        case "event":
          nextState.eventType = loadedEntity.eventType ?? "performance";
          nextState.businessStatus = loadedEntity.businessStatus ?? "scheduled";
          nextState.startAt = loadedEntity.startAt ? loadedEntity.startAt.slice(0, 16) : "";
          nextState.endAt = loadedEntity.endAt ? loadedEntity.endAt.slice(0, 16) : "";
          nextState.cityId = loadedEntity.cityId ?? "";
          nextState.venueEntityId = loadedEntity.venueId ?? "";
          nextState.troupeIds = loadedEntity.troupeIds ?? [];
          nextState.ticketUrl = loadedEntity.ticketUrl ?? "";
          nextState.duration = loadedEntity.duration ?? "";
          nextState.ticketStatus = loadedEntity.ticketStatus ?? "";
          nextState.noteText = loadedEntity.noteText ?? "";
          nextState.posterImageId = loadedEntity.posterImageId ?? "";
          nextState.programDetailed =
            loadedEntity.programDetailed?.map((item) => ({
              key: makeClientKey("program"),
              workEntityId: item.workEntityId ?? "",
              titleOverride: item.titleOverride ?? "",
              sequenceNo: item.sequenceNo ? String(item.sequenceNo) : "",
              durationMinutes: item.durationMinutes ? String(item.durationMinutes) : "",
              notes: item.notes ?? "",
              casts:
                item.casts?.map((cast) => ({
                  key: makeClientKey("cast"),
                  roleEntityId: cast.roleEntityId ?? "",
                  personEntityId: cast.personEntityId ?? "",
                  castNote: cast.castNote ?? ""
                })) ?? []
            })) ?? [];
          break;
        case "city":
          nextState.province = loadedEntity.province ?? "";
          break;
        case "article":
          nextState.articleType = loadedEntity.articleType ?? "term";
          nextState.abstract = loadedEntity.abstract ?? "";
          nextState.difficultyLevel = loadedEntity.difficultyLevel ?? "";
          nextState.bodySourceType = loadedEntity.bodySourceType ?? "";
          break;
        default:
          break;
      }

      const nextOptions = await getEditorOptions(loadedEntity.entityType, loadedEntity.id);
      if (!active) {
        return;
      }
      setFormState(nextState);
      setOptions(nextOptions);
      setLoaded(true);
    }

    (slug ? loadEditState() : loadCreateState()).catch(() => {
      if (active) {
        setMessage(slug ? "无法加载当前条目。" : "无法加载新建表单。");
        setLoaded(true);
      }
    });

    return () => {
      active = false;
    };
  }, [entityType, slug]);

  useEffect(() => {
    if (activeEntityType !== "work" || !options) {
      return;
    }
    if (formState.workType !== "excerpt") {
      return;
    }
    const parentId = typeof formState.parentWorkId === "string" ? formState.parentWorkId : "";
    const excerptName = typeof formState.excerptName === "string" ? formState.excerptName : "";
    const parent = options.fullWorks.find((item) => item.id === parentId);
    if (parent && excerptName.trim()) {
      setTitle(`${parent.title}·${excerptName.trim()}`);
    }
  }, [activeEntityType, formState.excerptName, formState.parentWorkId, formState.workType, options]);

  useEffect(() => {
    if (activeEntityType !== "event" || !options || !isCreateMode) {
      return;
    }
    const program = Array.isArray(formState.programDetailed) ? (formState.programDetailed as EventProgramItemRow[]) : [];
    const cityTitle = options.cities.find((item) => item.id === formState.cityId)?.title;
    const venueTitle = options.venues.find((item) => item.id === formState.venueEntityId)?.title;
    const troupeIds = Array.isArray(formState.troupeIds) ? (formState.troupeIds as string[]) : [];
    const troupeTitles = options.troupes.filter((item) => troupeIds.includes(item.id)).map((item) => item.title);
    const workIds = program.map((item) => item.workEntityId).filter(Boolean);
    const workTitles = options.fullWorks.filter((item) => workIds.includes(item.id)).map((item) => item.title);
    const excerptTitles = options.excerpts.filter((item) => workIds.includes(item.id)).map((item) => item.title);
    setTitle(
      buildEventTitle({
        startAt: typeof formState.startAt === "string" ? formState.startAt : "",
        cityTitle,
        venueTitle,
        troupeTitles,
        workTitles,
        excerptTitles
      })
    );
  }, [
    activeEntityType,
    formState.cityId,
    formState.programDetailed,
    formState.startAt,
    formState.troupeIds,
    formState.venueEntityId,
    isCreateMode,
    options
  ]);

  const entityTypeLabel = useMemo(() => {
    switch (activeEntityType) {
      case "work":
        return "剧目";
      case "person":
        return "人物";
      case "troupe":
        return "剧团";
      case "venue":
        return "剧场";
      case "event":
        return "演出";
      case "city":
        return "城市";
      case "article":
        return "知识条目";
      default:
        return "条目";
    }
  }, [activeEntityType]);

  const bodyLabel = useMemo(() => {
    switch (activeEntityType) {
      case "work":
        return "剧情或正文（支持 Markdown）";
      case "person":
        return "人物简介（支持 Markdown）";
      case "article":
        return "知识正文（支持 Markdown）";
      default:
        return "正文（支持 Markdown）";
    }
  }, [activeEntityType]);

  const modeLabel = isCreateMode ? "完整新建" : "提案编辑";
  const editSummaryFilled = Boolean(editSummary.trim());
  const bodyLength = body.trim().length;
  async function buildPayload() {
    const payload: Record<string, unknown> = {
      title,
      bodyMarkdown: body,
      coverImageId: formState.coverImageId || null
    };

    switch (activeEntityType) {
      case "work":
        payload.workType = formState.workType;
        payload.originalAuthor = formState.originalAuthor;
        payload.dynastyPeriod = formState.dynastyPeriod;
        payload.genreNote = formState.genreNote;
        payload.parentWorkId = formState.parentWorkId || null;
        payload.durationMinutes = formState.durationMinutes ? Number(formState.durationMinutes) : null;
        payload.firstKnownDate = formState.firstKnownDate;
        break;
      case "person":
        payload.personTypeNote = formState.personTypeNote;
        payload.gender = formState.gender;
        payload.birthDate = formState.birthDate ? new Date(String(formState.birthDate)).toISOString() : null;
        payload.deathDate = formState.deathDate ? new Date(String(formState.deathDate)).toISOString() : null;
        payload.birthCityId = formState.birthCityId || null;
        payload.isLiving = formState.isLiving ?? null;
        payload.personIdentities = (Array.isArray(formState.personIdentities) ? (formState.personIdentities as PersonIdentityRow[]) : []).map((item) => ({
          identityTerm: item.identityTerm,
          startDate: item.startDate ? new Date(item.startDate).toISOString() : null,
          endDate: item.endDate ? new Date(item.endDate).toISOString() : null
        }));
        payload.troupeMemberships = (
          Array.isArray(formState.troupeMemberships) ? (formState.troupeMemberships as TroupeMembershipRow[]) : []
        ).map((item) => ({
          troupeEntityId: item.troupeEntityId || null,
          membershipRole: item.membershipRole,
          startDate: item.startDate ? new Date(item.startDate).toISOString() : null,
          endDate: item.endDate ? new Date(item.endDate).toISOString() : null,
          isCurrent: item.isCurrent
        }));
        payload.representativeWorkIds = formState.representativeWorkIds ?? [];
        payload.representativeExcerptIds = formState.representativeExcerptIds ?? [];
        break;
      case "troupe":
        payload.troupeType = formState.troupeType;
        payload.foundedDate = formState.foundedDate ? new Date(String(formState.foundedDate)).toISOString() : null;
        payload.dissolvedDate = formState.dissolvedDate ? new Date(String(formState.dissolvedDate)).toISOString() : null;
        payload.cityId = formState.cityId || null;
        payload.cityText = formState.cityText;
        payload.regionText = formState.regionText;
        payload.officialWebsite = formState.officialWebsite;
        break;
      case "venue":
        payload.venueType = formState.venueType;
        payload.countryText = formState.countryText;
        payload.cityId = formState.cityId || null;
        payload.cityText = formState.cityText;
        payload.regionText = formState.regionText;
        payload.address = formState.address;
        payload.latitude = formState.latitude ? Number(formState.latitude) : null;
        payload.longitude = formState.longitude ? Number(formState.longitude) : null;
        payload.capacity = formState.capacity ? Number(formState.capacity) : null;
        break;
      case "event":
        payload.eventType = formState.eventType;
        payload.businessStatus = formState.businessStatus;
        payload.startAt = formState.startAt ? new Date(String(formState.startAt)).toISOString() : undefined;
        payload.endAt = formState.endAt ? new Date(String(formState.endAt)).toISOString() : null;
        payload.cityId = formState.cityId || null;
        payload.venueEntityId = formState.venueEntityId || null;
        payload.troupeIds = Array.isArray(formState.troupeIds) ? formState.troupeIds : [];
        payload.ticketUrl = formState.ticketUrl;
        payload.duration = formState.duration;
        payload.ticketStatus = formState.ticketStatus;
        payload.noteText = formState.noteText;
        payload.posterImageId = formState.posterImageId;
        payload.programDetailed = (Array.isArray(formState.programDetailed) ? (formState.programDetailed as EventProgramItemRow[]) : []).map((item) => ({
          workEntityId: item.workEntityId || null,
          titleOverride: item.titleOverride || null,
          sequenceNo: item.sequenceNo ? Number(item.sequenceNo) : null,
          durationMinutes: item.durationMinutes ? Number(item.durationMinutes) : null,
          notes: item.notes || null,
          casts: item.casts.map((cast) => ({
            roleEntityId: cast.roleEntityId || null,
            personEntityId: cast.personEntityId || null,
            castNote: cast.castNote || null
          }))
        }));
        break;
      case "city":
        payload.province = formState.province;
        break;
      case "article":
        payload.articleType = formState.articleType;
        payload.abstract = formState.abstract;
        payload.difficultyLevel = formState.difficultyLevel;
        payload.bodySourceType = formState.bodySourceType;
        break;
      default:
        break;
    }

    return payload;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeEntityType) {
      return;
    }

    setPending(true);
    setMessage(null);
    try {
      const payload = await buildPayload();
      if (isCreateMode) {
        await submitCreateProposal({
          entityType: activeEntityType,
          proposalType: "content_create",
          editSummary,
          payload: {
            ...payload,
            editSummary
          }
        });
        setMessage("创建提案已提交到审核队列。");
        setEditSummary("");
      } else {
        await submitProposal(slug!, {
          proposalType: "content_update",
          editSummary,
          payload: {
            ...payload,
            editSummary
          }
        });
        setMessage("提案已提交到审核队列。");
        setEditSummary("");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "提交失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.editorFormPage}>
      <EditorSummaryBar
        entityTypeLabel={entityTypeLabel}
        title={title || entity?.title || "未命名条目"}
        modeLabel={modeLabel}
        editSummaryFilled={!isCreateMode && editSummaryFilled}
        bodyLength={bodyLength}
        loaded={loaded}
        entity={entity}
      />

      <form className={`${styles.editForm} ${styles.editorForm}`} onSubmit={handleSubmit}>
        <div className={styles.editorFormIntro}>
          <p className={styles.editorFormEyebrow}>{isCreateMode ? "Full Create" : "Structured Editing"}</p>
          <h2>{isCreateMode ? `${entityTypeLabel}完整新建表单` : `${entityTypeLabel}完整编辑表单`}</h2>
          <p>现在所有可编辑内容都通过结构化表单录入，不再要求用户直接编辑 JSON。</p>
        </div>

        <CollapsibleFormSection
          title="基础信息"
          description="标题与正文会直接进入条目的公开主内容，所有条目都不再单独维护摘要。"
          summary={`${title.trim() || "未命名条目"} · 正文 ${bodyLength} 字`}
        >
          <div className={styles.formGrid}>
            <label className={styles.fieldSpanFull}>
              标题
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                disabled={pending || (activeEntityType === "work" && formState.workType === "excerpt")}
              />
            </label>
            <label className={styles.fieldSpanFull}>
              {bodyLabel}
              <textarea rows={10} value={body} onChange={(event) => setBody(event.target.value)} disabled={pending} />
            </label>
            <label className={styles.fieldSpanFull}>
              封面素材 ID
              <input value={String(formState.coverImageId ?? "")} onChange={(event) => setField("coverImageId", event.target.value)} disabled={pending} />
            </label>
          </div>
        </CollapsibleFormSection>

        {activeEntityType === "work" && options ? (
          <WorkFields formState={formState} options={options} setField={setField} createQuickOption={createQuickOption} />
        ) : null}

        {activeEntityType === "person" && options ? (
          <PersonFields
            formState={formState}
            options={options}
            setField={setField}
            toggleArrayField={toggleArrayField}
            appendStructuredRow={appendStructuredRow}
            updateStructuredRow={updateStructuredRow}
            removeStructuredRow={removeStructuredRow}
            createQuickOption={createQuickOption}
            isDraftEntity={isDraftEntity}
          />
        ) : null}

        {activeEntityType === "troupe" && options ? (
          <TroupeFields formState={formState} options={options} setField={setField} createQuickOption={createQuickOption} />
        ) : null}

        {activeEntityType === "venue" && options ? (
          <VenueFields formState={formState} options={options} setField={setField} createQuickOption={createQuickOption} />
        ) : null}

        {activeEntityType === "event" && options ? (
          <EventFields
            formState={formState}
            options={options}
            setField={setField}
            toggleArrayField={toggleArrayField}
            appendStructuredRow={appendStructuredRow}
            updateStructuredRow={updateStructuredRow}
            removeStructuredRow={removeStructuredRow}
            createQuickOption={createQuickOption}
            isDraftEntity={isDraftEntity}
          />
        ) : null}

        {activeEntityType === "city" ? <CityFields formState={formState} setField={setField} /> : null}

        {activeEntityType === "article" && options ? (
          <ArticleFields formState={formState} options={options} setField={setField} />
        ) : null}

        {!isCreateMode ? (
          <CollapsibleFormSection
            title="提交审核"
            description="编辑说明会进入提案与版本历史。留空时会自动使用你的签名和提交时间。"
            summary={editSummary.trim() ? "已填写编辑说明" : "编辑说明为空"}
            defaultExpanded={false}
          >
            <div className={styles.formGrid}>
              <label className={styles.fieldSpanFull}>
                编辑说明
                <textarea value={editSummary} onChange={(event) => setEditSummary(event.target.value)} disabled={pending} />
              </label>
            </div>
          </CollapsibleFormSection>
        ) : null}

        <ActionBar>
          <button type="submit" disabled={pending || !loaded || !title.trim()}>
            {pending ? "提交中..." : isCreateMode ? "创建条目" : "提交提案"}
          </button>
          {message ? <p className={styles.statusMessage}>{message}</p> : null}
        </ActionBar>
      </form>
    </div>
  );
}
