const { runCategory } = require('D:/VSCode/playwright/results/run_category.js');

const category = {
  "category": "五、权限矩阵",
  "feature": "权限矩阵",
  "test_cases": [
    {
      "name": "Project Manager权限",
      "steps": [
        "用户角色为Project Manager",
        "管理看板、添加成员"
      ],
      "expectation": "操作生效"
    },
    {
      "name": "Editor权限",
      "steps": [
        "用户角色为Editor",
        "创建/删除任务和列表"
      ],
      "expectation": "操作生效"
    },
    {
      "name": "Commenter权限",
      "steps": [
        "用户角色为Commenter",
        "查看内容或发表评论"
      ],
      "expectation": "可查看+评论"
    },
    {
      "name": "Viewer权限",
      "steps": [
        "用户角色为Viewer",
        "查看看板"
      ],
      "expectation": "仅可查看"
    }
  ]
};

runCategory({
  category,
  resultDir: require('path').resolve(__dirname, '..'),
  categoryIndex: 5,
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
