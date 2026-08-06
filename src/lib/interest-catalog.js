// src/lib/interest-catalog.js
// 興趣的策展分類常數：設定頁「大分支→小分支」選擇器的資料來源（見計劃 Step 1）。
// 勾選結果以子分支 label 存進畫像的扁平 interests 陣列（見 src/lib/user-profile.js）；
// 此常數僅供 UI 與回填匹配使用。大分支為獨立生活領域，與日曆分類（calendar-catalog.js）並存。

export const INTEREST_CATEGORIES = [
  {
    id: "medical",
    label: "醫療健康",
    subBranches: [
      "覆診／複診",
      "疫苗接種",
      "健康檢查",
      "慢性病管理",
      "牙科／眼科",
      "心理健康",
    ],
  },
  {
    id: "government",
    label: "政府與民生",
    subBranches: [
      "津貼／福利申請",
      "證件續期",
      "稅務申報",
      "公屋／住屋",
      "交通補助",
      "選舉／市政",
    ],
  },
  {
    id: "work",
    label: "工作與職場",
    subBranches: [
      "會議／行程",
      "培訓／證照",
      "請假／考勤",
      "求職／面試",
      "創業／營運",
    ],
  },
  {
    id: "education",
    label: "教育與親子",
    subBranches: [
      "課程／報名",
      "考試日期",
      "學校／學期",
      "育兒／親子活動",
      "長者照護",
    ],
  },
  {
    id: "leisure",
    label: "休閒娛樂",
    subBranches: ["美食／餐飲", "遊戲／電競", "閱讀／書店", "主題樂園"],
  },
  {
    id: "sports",
    label: "運動與戶外",
    subBranches: [
      "健身／瑜伽",
      "球類運動",
      "跑步／馬拉松",
      "游泳／水上活動",
      "爬山／露營",
      "體育賽事",
    ],
  },
  {
    id: "travel",
    label: "旅遊與出行",
    subBranches: [
      "假期／旅遊計畫",
      "機票／酒店",
      "交通卡／過境",
      "護照／簽證",
      "巴士／輕軌時刻",
    ],
  },
  {
    id: "finance",
    label: "金融與帳單",
    subBranches: [
      "帳單／繳費",
      "信用卡",
      "投資／理財",
      "保險",
      "退休金／強積金",
    ],
  },
  {
    id: "festival",
    label: "宗教／節慶",
    subBranches: [
      "廟宇慶典",
      "端午／中秋",
      "清明／掃墓",
      "農曆新年",
      "教會／禮拜",
    ],
  },
  {
    id: "community",
    label: "志工／社區",
    subBranches: ["義工服務", "長者探訪", "社區活動", "慈善捐款"],
  },
  {
    id: "culture",
    label: "文化藝術",
    subBranches: ["展覽／博物館", "演唱會／音樂", "電影／戲劇", "藝文課程"],
  },
];

// 全部子分支 label 的集合，供回填時把「非策展的自訂項」留在文字框（見計劃 Step 2）。
export const INTEREST_SUB_BRANCH_LABELS = new Set(
  INTEREST_CATEGORIES.flatMap((category) => category.subBranches),
);
