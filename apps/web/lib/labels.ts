export function mapEntityTypeLabel(value: string) {
  const labels: Record<string, string> = {
    work: "剧目",
    person: "人物",
    troupe: "院团",
    venue: "场馆",
    event: "演出",
    city: "城市",
    article: "知识条目",
    role: "角色",
    lineage: "传承",
    topic: "专题"
  };
  return labels[value] ?? value;
}

export function mapPublishStatusLabel(value: string) {
  const labels: Record<string, string> = {
    draft: "草稿",
    published: "已发布",
    archived: "已归档",
    pending_review: "待审核"
  };
  return labels[value] ?? value;
}

export function mapReviewStatusLabel(value: string) {
  const labels: Record<string, string> = {
    pending: "待审核",
    approved: "已通过",
    rejected: "已驳回"
  };
  return labels[value] ?? value;
}

export function mapEventStatusLabel(value: string) {
  const labels: Record<string, string> = {
    announced: "已公布",
    scheduled: "已排期",
    completed: "已结束",
    cancelled: "已取消",
    postponed: "已延期"
  };
  return labels[value] ?? value;
}

export function mapEventTypeLabel(value: string) {
  const labels: Record<string, string> = {
    performance: "演出",
    festival: "艺术节",
    lecture: "讲座",
    memorial: "纪念活动"
  };
  return labels[value] ?? value;
}

export function mapWorkTypeLabel(value: string) {
  const labels: Record<string, string> = {
    full_play: "正戏",
    excerpt: "折子戏",
    adapted_piece: "改编作品"
  };
  return labels[value] ?? value;
}

export function mapArticleTypeLabel(value: string) {
  const labels: Record<string, string> = {
    term: "术语",
    costume: "服饰",
    music: "音乐",
    history: "历史",
    technique: "技艺"
  };
  return labels[value] ?? value;
}

export function mapTroupeTypeLabel(value: string) {
  const labels: Record<string, string> = {
    troupe: "院团",
    school: "院校",
    research_org: "研究机构",
    theater_org: "剧场机构"
  };
  return labels[value] ?? value;
}

export function mapParticipationRoleLabel(value: string) {
  const labels: Record<string, string> = {
    performer: "演出",
    organizer: "主办",
    guest: "嘉宾",
    host: "主持"
  };
  return labels[value] ?? value;
}

export function mapUserRoleLabel(value: string) {
  const labels: Record<string, string> = {
    visitor: "访客",
    bot: "机器人",
    editor: "编辑",
    reviewer: "审核",
    admin: "管理员"
  };
  return labels[value] ?? value;
}

export function mapUserStatusLabel(value: string) {
  const labels: Record<string, string> = {
    active: "正常",
    suspended: "停用",
    pending: "待激活"
  };
  return labels[value] ?? value;
}

export function mapProposalTypeLabel(value: string) {
  const labels: Record<string, string> = {
    content_update: "内容修改"
  };
  return labels[value] ?? value;
}
