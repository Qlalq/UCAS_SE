const { runCategory } = require('D:/VSCode/playwright/results/run_category.js');

const category = {
  "category": "六、通知系统",
  "feature": "通知系统",
  "test_cases": [
    {
      "name": "查看通知",
      "steps": [
        "以任何身份登录系统",
        "点击顶部的铃铛图标"
      ],
      "expectation": "应显示通知列表，包含未读/已读状态"
    },
    {
      "name": "卡片评论通知",
      "steps": [
        "用户已订阅某卡片",
        "该卡片收到评论"
      ],
      "expectation": "订阅者收到通知"
    },
    {
      "name": "通知过滤",
      "steps": [
        "存在多条通知",
        "按项目/看板/用户/卡片过滤"
      ],
      "expectation": "仅显示匹配通知"
    },
    {
      "name": "活动日志",
      "steps": [
        "看板中有操作记录",
        "查看活动日志"
      ],
      "expectation": "显示创建和更新时间"
    }
  ]
};

runCategory({
  category,
  resultDir: require('path').resolve(__dirname, '..'),
  categoryIndex: 6,
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
