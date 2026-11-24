export function mapSearch(keyword: string, city = '杭州') {
	return 'https://uri.amap.com/search?' + new URLSearchParams({ keyword, city, view: 'map' });
}

export const tripDays = [
	{
		id: 'westlake',
		date: '2026-11-24',
		day: '11 月 24 日 · 周二',
		label: '断桥',
		title: '断桥与西湖北岸',
		intro: '从断桥看湖，沿北山街转去岳王庙。曲院风荷留给还有体力的时候。',
		transport: '打车到少年宫，再沿北山街转去岳庙',
		navigation: { label: '高德找少年宫站', url: mapSearch('少年宫公交站') },
		timeline: [
			{
				time: '13:00 左右',
				title: '午饭后去断桥',
				detail: '打车到北山街的少年宫公交站，沿湖往西走。桥头就能看湖，走得舒服再上桥，往白堤走一小段后折返，留 30–45 分钟。',
			},
			{
				time: '14:15 左右',
				title: '去岳王庙看忠烈祠',
				detail: '坐 7 路往灵隐方向到岳庙站，或短程打车。岳王庙在北山街 80 号，挑忠烈祠和碑廊看，留 30–45 分钟。',
			},
			{
				time: '15:15 以后',
				title: '曲院风荷短走，或坐坐回家',
				detail: '从岳庙对面入园，沿水岸走 15–20 分钟就折返。爸妈累了，可以在岳庙附近休息，再叫车回住处。',
			},
		],
		note: {
			title: '岳王庙门票',
			detail: '成人票 ¥25。符合条件的满 70 周岁老人凭身份证免费。',
			links: [
				{ label: '岳王庙参观信息', url: 'https://jrsh.hangzhou.com.cn/content/2026-10/15/content_9339758.html' },
				{ label: '高德找岳王庙', url: mapSearch('岳王庙') },
			],
		},
	},
	{
		id: 'lingyin',
		date: '2026-11-25',
		day: '11 月 25 日 · 周三',
		label: '灵隐寺',
		title: '庆春朴门与灵隐寺',
		intro: '先到白乐桥吃素餐，再按下午场预约游灵隐飞来峰。',
		transport: '西溪路 608 号换接驳，先到白乐桥吃午饭',
		navigation: { label: '高德找接驳点', url: mapSearch('西溪路608号停车场') },
		timeline: [
			{
				time: '10:30–11:30',
				title: '打车到西溪路 608 号，换灵隐接驳',
				detail: '从香樟公寓附近出发，按现场指示换车，到灵隐路 32 号后步行去白乐桥。',
			},
			{
				time: '11:30–12:45',
				title: '庆春朴门灵隐店吃午饭',
				detail: '白乐桥 181 号，参考人均 ¥107。三人可以分黑松露炒饭、炭火煨牛蒡汤、桂花荔浦芋头，再加一份时蔬。',
			},
			{
				time: '13:15–14:45',
				title: '飞来峰造像、天王殿和大雄宝殿',
				detail: '带各自的有效证件原件，从预约单指引的入口进园。主路边挑一两处造像，逛到大雄宝殿后按体力折返。午饭等位久，可以顺延到 14:00 入园。',
			},
			{
				time: '15:00 左右',
				title: '接驳或坐公交回住处',
				detail: '从灵隐路 32 号坐 319 路到皇朝花园，或按现场指引坐接驳到外围换乘点，再打车。',
			},
		],
		note: {
			title: '确认 11:30 的三人座',
			detail: '电话问是否有位、座位是否需要走台阶。平台列营业时间为 11:00–21:00。灵隐飞来峰已约下午场，景区 17:00 停止入园。',
			links: [
				{ label: '庆春朴门 0571-87975777', url: 'tel:+8657187975777' },
				{ label: '高德找庆春朴门', url: 'https://gaode.com/place/B0GKVZ1O4T' },
				{ label: '餐厅与菜单', url: 'https://gs.ctrip.com/html5/you/foods/fooddetail/2854/25044096.html' },
				{ label: '灵隐入园须知', url: 'https://www.lingyinsi.org/detail_57_19455.html' },
			],
		},
	},
	{
		id: 'suzhou',
		date: '2026-11-26',
		day: '11 月 26 日 · 周四',
		label: '苏州',
		title: '苏州古城一日往返',
		intro: '上午看拙政园和苏博本馆，下午在平江路喝茶、听评弹，当晚回杭州。',
		transport: '杭州东坐 G1866 去苏州北，从苏州站返程',
		navigation: { label: '铁路 12306', url: 'https://www.12306.cn/index/' },
		timeline: [
			{
				time: '06:00–09:02',
				title: '杭州东 07:27 坐 G1866 到苏州北',
				detail: '约 06:00–06:10 从住处打车，目标 06:40 到杭州东。09:02 到苏州北，出站直接打车去拙政园。',
			},
			{
				time: '09:50–12:15',
				title: '拙政园与苏州博物馆本馆',
				detail: '拙政园看中部、远香堂和池边。约 11:15 到隔壁东北街 204 号的苏博本馆，看看庭院和一两个展厅，按约到的场次调整。',
			},
			{
				time: '12:30–13:45',
				title: '坐下来吃苏帮菜',
				detail: '松鹤楼观前街店在太监弄 72 号，可分一份松鼠鳜鱼。想顺路吃小份，选平江路 115 号的桃花源记平江 1 店，参考人均 ¥49。',
			},
			{
				time: '14:00–16:15',
				title: '平江路短逛、喝茶听评弹',
				detail: '从白塔东路一带进，沿河走一小段就找地方坐下。有合适的场次就听评弹。之后留时间吃点东西、歇脚。',
			},
			{
				time: '17:30–20:25',
				title: '苏州站 18:52 坐 G7491 回杭州东',
				detail: '约 17:30 叫车去苏州站，目标 18:10 到站。20:25 到杭州东后打车回香樟公寓，也可坐地铁 19 号线到五联。',
			},
		],
		note: {
			title: '车次与预约备选',
			detail: '晚起可选 G7372，杭州东 08:09 → 苏州站 10:03，拙政园约 10:45 以后。想早回杭州可选 G1227，苏州北 18:25 → 杭州东 19:44，约 16:50 从古城出发。两处景点分别预约，车次和余票以 12306 为准。',
			links: [
				{ label: '11 月 26 日去程', url: 'https://train.qunar.com/train/tickets/hangzhoudong-to-suzhou/2026-11-26' },
				{ label: '11 月 26 日回程', url: 'https://huoche.qunar.com/train/tickets/suzhou-to-hangzhoudong/2026-11-26' },
				{ label: '拙政园开放时间', url: 'https://ylj.suzhou.gov.cn/szsylj/kfsj/wztt.shtml' },
				{ label: '苏博本馆预约办法', url: 'https://wglj.suzhou.gov.cn/szwhgdhlyj/yebo/202609/8dee494a6a564f64bfaef77cc1f84f17.shtml' },
				{ label: '高德找苏州北站', url: mapSearch('苏州北站', '苏州') },
			],
		},
	},
];
