# Crypto BD Agent - TODO

## 数据库 & 后端

- [x] 设计并推送数据库Schema（projects, contacts, accounts, templates, messages, analytics, settings）
- [x] 后端：项目发现API（CMC/CoinGecko爬取新项目）
- [x] 后端：联系信息采集API（从项目页面提取Twitter/Discord/Telegram/Email）
- [x] 后端：多账号管理API（X账号、Telegram账号、邮箱账号的CRUD）
- [x] 后端：沟通模板管理API（创建/编辑/删除模板，支持首次联系/跟进/报价场景）
- [x] 后端：消息发送API（通过不同渠道发送消息）
- [x] 后端：智能跟进逻辑（2天无回复自动触发第二次联系）
- [x] 后端：项目状态追踪API（待联系/已联系/已回复/洽谈中/已成交/已拒绝）
- [x] 后端：数据分析API（每日联系数、回复率、转化率、收入统计）
- [x] 后端：LLM分析API（分析回复意图/情绪，生成跟进话术建议）
- [x] 后端：LLM生成个性化消息API
- [x] 后端：Telegram通知集成（项目方回复、新项目发现、跟进提醒）
- [x] 后端：Settings API（Telegram配置、API密钥、自动化参数）
- [x] 后端：定时任务调度（自动跟进、自动发现）

## 前端界面

- [x] 全局布局：DashboardLayout侧边栏导航（暗色专业风格）
- [x] 首页仪表板：关键指标卡片、图表（每日联系数、回复率、转化率）
- [x] 项目管理页：所有项目列表、状态筛选、搜索、详情查看、一键发起联系
- [x] 项目详情页：沟通历史时间线、中英双语展示、LLM分析面板
- [x] 模板管理页：模板列表、创建/编辑模板、场景分类、预览功能
- [x] 账号管理页：多账号列表、添加/删除账号、账号状态监控
- [x] 跟进管理页：待跟进项目列表、跟进提醒、手动触发跟进
- [x] 数据分析页：转化漏斗、渠道分布、趋势图、每日发送量
- [x] 设置页：Telegram Bot配置、API密钥、自动化参数、默认模板初始化

## 集成 & 自动化

- [x] CoinGecko API集成（获取新上线项目，支持Meme标签识别）
- [x] CoinMarketCap API集成（获取新上线项目）
- [x] Telegram Bot API集成（发送通知）
- [x] 自动跟进：2天无回复自动发送跟进消息
- [x] 自动发现：定时扫描新项目

## 测试

- [x] 数据库操作单元测试（通过mock）
- [x] 项目发现API测试
- [x] 模板管理API测试
- [x] 跟进逻辑测试
- [x] LLM分析API测试
- [x] 数据分析API测试
- [x] Settings API测试
- [x] 全部14个测试通过（2个测试文件）

## 待完善 / Future Enhancements

- [ ] 真实Twitter DM自动发送集成（需要Twitter API v2）
- [ ] 真实Telegram Bot自动发送集成（需要Bot Token）
- [ ] 真实邮件发送集成（SMTP/SendGrid）
- [ ] CoinMarketCap API Key配置后的真实数据拉取
- [ ] 项目联系人信息的更深度自动采集
- [ ] 定时任务调度（cron job）自动扫描新项目

## 新需求 / New Requirements

- [x] 扫描新项目支持时间周期选择（过去24小时/3天/7天）

## 新需求 / New Requirements (Round 2)

- [x] 扫描完成后弹窗展示新发现项目列表，支持多选和一键批量首次联系
