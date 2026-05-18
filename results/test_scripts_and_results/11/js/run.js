const { runCategory } = require('D:/VSCode/playwright/results/run_category.js');

const category = {
  "category": "十一、视图管理",
  "feature": "视图管理",
  "test_cases": [
    {
      "name": "切换视图",
      "steps": [
        "以任何身份登录系统，打开看板",
        "点击工具栏上的视图切换按钮"
      ],
      "expectation": "应在看板视图和列表视图之间切换"
    },
    {
      "name": "列表视图排序",
      "steps": [
        "以任何身份登录系统，打开列表视图",
        "点击列标题进行排序，选择多列排序"
      ],
      "expectation": "列表应按照排序条件显示"
    },
    {
      "name": "列表视图列管理",
      "steps": [
        "以任何身份登录系统，打开列表视图",
        "使用列表菜单添加/删除列，调整列宽"
      ],
      "expectation": "列表视图应按照调整后的设置显示"
    }
  ]
};

runCategory({
  category,
  resultDir: require('path').resolve(__dirname, '..'),
  categoryIndex: 11,
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
