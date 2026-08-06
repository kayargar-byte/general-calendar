// src/lib/interest-catalog.js
// 興趣的策展分類常數：設定頁「大分支→小分支」選擇器的資料來源（見計劃 Step 1）。
// 勾選結果以子分支 label 存進畫像的扁平 interests 陣列（見 src/lib/user-profile.js）；
// 此常數僅供 UI 與回填匹配使用。大分支為獨立生活領域，與日曆分類（calendar-catalog.js）並存。
//
// 2026-08-06 暫時移除子分支：子分類選項令用戶困惑（跨類重疊、教育與親子含長者照護等），
// 暫時只保留大分類與自訂文字框（SettingsDialog 在無子分支時自動隱藏選擇樹）。
// 恢復：補回各分類的 subBranches 清單即可（原清單見 git history）。

export const INTEREST_CATEGORIES = [
  {
    id: "medical",
    label: "醫療健康",
    subBranches: [],
  },
  {
    id: "government",
    label: "政府與民生",
    subBranches: [],
  },
  {
    id: "work",
    label: "工作與職場",
    subBranches: [],
  },
  {
    id: "education",
    label: "教育與親子",
    subBranches: [],
  },
  {
    id: "leisure",
    label: "休閒娛樂",
    subBranches: [],
  },
  {
    id: "sports",
    label: "運動與戶外",
    subBranches: [],
  },
  {
    id: "travel",
    label: "旅遊與出行",
    subBranches: [],
  },
  {
    id: "finance",
    label: "金融與帳單",
    subBranches: [],
  },
  {
    id: "festival",
    label: "宗教／節慶",
    subBranches: [],
  },
  {
    id: "community",
    label: "志工／社區",
    subBranches: [],
  },
  {
    id: "culture",
    label: "文化藝術",
    subBranches: [],
  },
];

// 全部子分支 label 的集合，供回填時把「非策展的自訂項」留在文字框（見計劃 Step 2）。
// 子分支暫時移除期間為空集合，所有已存興趣一律視為自訂項顯示在文字框。
export const INTEREST_SUB_BRANCH_LABELS = new Set(
  INTEREST_CATEGORIES.flatMap((category) => category.subBranches),
);
