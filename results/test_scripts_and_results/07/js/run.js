const { runCategory } = require('D:/VSCode/playwright/results/run_category.js');

const category = {
  "category": "七、API",
  "feature": "API",
  "test_cases": [
    {
      "name": "API认证",
      "steps": [
        "持有有效Client ID/Secret",
        "调用API"
      ],
      "expectation": "正确响应"
    },
    {
      "name": "权限控制",
      "steps": [
        "用户无对应权限",
        "调用API"
      ],
      "expectation": "返回403"
    },
    {
      "name": "创建卡片API",
      "steps": [
        "已通过API认证",
        "调用创建卡片API指定列表"
      ],
      "expectation": "卡片正确创建到指定列表"
    }
  ]
};

runCategory({
  category,
  resultDir: require('path').resolve(__dirname, '..'),
  categoryIndex: 7,
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
