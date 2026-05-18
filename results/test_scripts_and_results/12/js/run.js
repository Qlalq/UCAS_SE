const { runCategory } = require('D:/VSCode/playwright/results/run_category.js');

const category = {
  "category": "十二、日志管理",
  "feature": "日志管理",
  "test_cases": [
    {
      "name": "配置日志暴露",
      "steps": [
        "系统已安装4ga Boards，编辑docker-compose.yml文件",
        "添加./logs/:/app/logs/到volumes"
      ],
      "expectation": "日志目录应被暴露到主机机器"
    },
    {
      "name": "配置日志轮转",
      "steps": [
        "系统已安装4ga Boards，创建logrotate配置文件",
        "在/etc/logrotate.d/创建4gaBoards配置文件"
      ],
      "expectation": "日志应按照配置自动轮转"
    },
    {
      "name": "配置Fail2ban",
      "steps": [
        "系统已安装4ga Boards，创建fail2ban配置文件",
        "在/etc/fail2ban/filter.d/和/etc/fail2ban/jail.d/创建配置文件"
      ],
      "expectation": "Fail2ban应能检测并阻止失败的认证尝试"
    }
  ]
};

runCategory({
  category,
  resultDir: require('path').resolve(__dirname, '..'),
  categoryIndex: 12,
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
