---
name: sales-客户跟进邮件起草
description: 从成功任务沉淀（sales，评分 88）：为已演示客户起草跟进邮件，含下一步 POC 时间安排
metadata:
  source: hivemind-task-engine
  task_type: sales
  score: 88
  created_at: 2026-06-09T14:20:00+00:00
---

# 为已演示客户起草跟进邮件（含 POC 排期）

## 适用场景

- 任务类型：`sales`
- 演示后 24–48 小时内需发送跟进邮件
- 需引用演示中客户关心的功能点（而非通用模板）

## 推荐步骤

1. memory_search — 读取该客户名称、联系人、演示关注点
2. query_wiki — 调取标准 POC 流程与典型周期（2 周 / 4 周）
3. draft_email — 结构：致谢 →  recap 三个演示亮点 → POC 建议时间与交付物 → 明确 CTA（确认时间 / 补充资料清单）
4. human_review — 对外发送前走人工审核（wechat_work_send / email 同理）

## 反思要点

- 避免在首封跟进里堆价格细节，POC 目标应单一（如「工单闭环」）
- 语气匹配客户规模：国企偏正式，创业公司可更短

## 产出示例

主题：感谢今日交流 — HiveMind 工单 POC 建议安排

王总您好，感谢今日演示。您提到的「销售转实施信息不断档」正是 HiveMind 工单模块的核心场景。建议下周起 2 周 POC：第 1 周对接企微单聊 + Wiki 知识检索，第 2 周跑通 1 条真实工单。若方便，请回复可参与的技术对接人，我们发送环境清单。
