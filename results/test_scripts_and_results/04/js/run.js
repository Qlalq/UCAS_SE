const { runCategory } = require('D:/VSCode/playwright/results/run_category.js');

const category = {
  "category": "四、导入/导出",
  "feature": "导入/导出",
  "test_cases": [
    {
      "name": "Trello JSON导入",
      "steps": [
        "准备了Trello JSON文件",
        "执行导入"
      ],
      "expectation": "看板、列表、卡片、标签正确映射"
    },
    {
      "name": "4ga Boards导出/导入",
      "steps": [
        "看板中有数据",
        "导出为.tgz再导入"
      ],
      "expectation": "数据完整还原"
    },
    {
      "name": "无效文件导入",
      "steps": [
        "准备了无效格式文件",
        "尝试导入"
      ],
      "expectation": "拒绝，提示格式错误"
    },
    {
      "name": "从4ga Boards导入",
      "steps": [
        "以项目经理身份登录系统，有4ga Boards导出的.tgz文件",
        "创建新看板，选择\"Import\"，选择4ga Boards选项，上传.tgz文件"
      ],
      "expectation": "应成功导入4ga Boards看板数据"
    },
    {
      "name": "导出看板",
      "steps": [
        "以任何身份登录系统，打开看板",
        "打开看板上下文菜单，选择\"Export Board\""
      ],
      "expectation": "应生成.tgz格式的看板导出文件"
    }
  ]
};

runCategory({
  category,
  resultDir: require('path').resolve(__dirname, '..'),
  categoryIndex: 4,
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
