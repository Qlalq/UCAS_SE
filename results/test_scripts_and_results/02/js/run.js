const { runCategory } = require('D:/VSCode/playwright/results/run_category.js');

const category = {
  "category": "二、项目/看板管理",
  "feature": "项目/看板管理",
  "test_cases": [
    {
      "name": "创建项目",
      "steps": [
        "用户已登录",
        "创建新项目"
      ],
      "expectation": "项目出现在dashboard"
    },
    {
      "name": "项目权限层级",
      "steps": [
        "普通用户未被添加到某项目",
        "查看项目列表"
      ],
      "expectation": "仅见被添加的项目"
    },
    {
      "name": "创建看板",
      "steps": [
        "用户在某项目内",
        "选择simple/kanban模板创建看板"
      ],
      "expectation": "正确生成预设列表"
    },
    {
      "name": "看板视图切换",
      "steps": [
        "看板中有数据",
        "board/list view间切换"
      ],
      "expectation": "数据同步一致"
    },
    {
      "name": "删除项目",
      "steps": [
        "用户已登录且项目存在",
        "确认删除弹窗后删除"
      ],
      "expectation": "数据清空"
    },
    {
      "name": "重命名项目",
      "steps": [
        "用户已登录且项目存在",
        "重命名确认"
      ],
      "expectation": "名称更新"
    },
    {
      "name": "查看项目",
      "steps": [
        "用户已登录且项目存在",
        "点击查看"
      ],
      "expectation": "正确显示项目"
    },
    {
      "name": "非管理员创建项目",
      "steps": [
        "管理员已禁用普通用户创建项目",
        "普通用户尝试创建"
      ],
      "expectation": "拒绝创建"
    }
  ]
};

runCategory({
  category,
  resultDir: require('path').resolve(__dirname, '..'),
  categoryIndex: 2,
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
