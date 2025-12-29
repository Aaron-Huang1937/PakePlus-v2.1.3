// 文本分析工具类
class TextAnalyzer {
    constructor() {
        // 企业类型关键词映射
        this.companyTypeKeywords = {
            '娱乐': ['娱乐', 'KTV', '歌厅', '夜总会', '酒吧'],
            '游艺': ['游艺', '电玩', '游戏厅', '娱乐城'],
            '网吧': ['网吧', '网咖', '网络会所', '上网服务'],
            '影院': ['影院', '电影院', '影城', '影厅'],
            '游泳': ['游泳', '游泳馆', '游泳池', '水上乐园'],
            '出版物': ['书店', '图书', '出版', '音像'],
            '印刷': ['印刷', '打印', '复印', '广告制作'],
            '文物': ['文物', '古玩', '收藏', '古迹', '遗址', '纪念馆', '故居', '城墙', '孔庙', '考棚', '记碑', '公祠', '庙宇'],
            '演出': ['演出', '剧场', '音乐厅', '舞台'],
            '表演团体': ['表演', '艺术团', '乐团', '舞蹈团'],
            '旅行社': ['旅行社', '旅游公司'],
            '旅行社分社': ['分社', '分公司'],
            '旅行社网点': ['网点', '门市部'],
            '海上运动休闲': ['海上运动', '帆船', '游艇', '海钓'],
            '体育场馆': ['体育', '健身', '球馆', '运动场'],
            '校园周边': ['校园周边', '文具店', '小卖部'],
            '密室逃脱': ['密室', '逃脱', '密室逃脱'],
            '剧本杀': ['剧本杀', '推理'],
            '校外培训': ['培训', '教育', '学校', '补习'],
            '广电': ['广播', '电视', '有线电视'],
            '其他': ['其他']
        };

        // 日期正则表达式
        this.datePatterns = [
            /(\d{4})年(\d{1,2})月(\d{1,2})日/g,
            /(\d{4})-(\d{1,2})-(\d{1,2})/g,
            /(\d{4})\/(\d{1,2})\/(\d{1,2})/g,
            /(\d{1,2})月(\d{1,2})日/g,
        ];

        // 数量正则表达式
        this.quantityPatterns = [
            /共(\d+)家/g,
            /总计(\d+)家/g,
            /(\d+)家企业/g,
            /检查了(\d+)家/g,
            /检查(\d+)家/g,
            /(\d+)户/g,
        ];

        // 人员数量正则表达式
        this.staffPatterns = [
            /出动(\d+)人/g,
            /参与(\d+)人/g,
            /(\d+)名执法人员/g,
            /执法人员(\d+)人/g,
        ];
    }

    // 分析检查文本
    analyzeInspectionText(text) {
        return {
            dates: this.extractDates(text),
            companies: this.extractCompanies(text),
            quantities: this.extractQuantities(text),
            staffCounts: this.extractStaffCounts(text),
            companyTypes: this.identifyCompanyTypes(text)
        };
    }

    // 提取日期
    extractDates(text) {
        const dates = [];
        const currentYear = new Date().getFullYear();

        this.datePatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                let dateStr = '';
                if (match.length === 4) {
                    // 完整年月日
                    dateStr = `${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`;
                } else if (match.length === 3) {
                    // 月日格式，使用当前年份
                    dateStr = `${currentYear}-${String(match[1]).padStart(2, '0')}-${String(match[2]).padStart(2, '0')}`;
                }

                if (dateStr && this.isValidDate(dateStr)) {
                    dates.push(dateStr);
                }
            }
        });

        return [...new Set(dates)]; // 去重
    }

    // 提取企业名称
    extractCompanies(text) {
        const companies = [];

        // 优先提取括号内的企业名称（重点分析括号内容）
        const bracketPatterns = [
            /[（(]([^）)]+)[）)]/g,  // 中英文括号
            /[【]([^】]+)[】]/g,      // 方括号
            /[「]([^」]+)[」]/g       // 书名号
        ];

        // 处理括号内容
        bracketPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                const bracketContent = match[1].trim();
                // 使用多种分隔符分割企业名称
                const separators = /[，,、；;\/]/;
                const names = bracketContent.split(separators)
                    .map(name => name.trim())
                    .filter(name => name && name.length > 0);
                
                names.forEach(name => {
                    // 清理末尾的标点符号
                    const cleanName = name.replace(/[，,、；;。.！!？?）)】」]$/, '').trim();
                    if (cleanName.length > 0 && cleanName.length < 50) {
                        // 检查是否已存在，避免重复
                        if (!companies.includes(cleanName)) {
                            companies.push(cleanName);
                        }
                    }
                });
            }
        });

        // 如果括号内没有找到企业，使用传统模式
        if (companies.length === 0) {
            // 常见的企业名称模式
            const companyPatterns = [
                /([^，。、\s]+(?:有限公司|股份有限公司|公司|企业|中心|店|厂|馆|院|所|社|部))/g,
                /([^，。、\s]+(?:KTV|网吧|网咖|影院|游泳馆|书店|印刷厂|旅行社))/g,
                // 文物场所特殊模式
                /([^，。、\s]*(?:故居|考棚|记碑|孔庙|城墙|公词|公祠|庙宇|古迹|文物|遗址|纪念馆))/g,
                // 文物点模式
                /([^，。、\s]+文物点)/g,
                // 更广泛的文物相关模式
                /([^，。、\s]+(?:故居|考棚|记碑|孔庙|城墙|公祠|庙宇|古迹|文物|遗址|纪念馆|墓))/g
            ];

            companyPatterns.forEach(pattern => {
                let match;
                while ((match = pattern.exec(text)) !== null) {
                    const company = match[1].trim();
                    if (company.length > 1 && company.length < 50) {
                        companies.push(company);
                    }
                }
            });
        }
        
        // 特殊处理：如果仍未找到企业，但文本中包含文物相关词汇，则查找文物点名称
        if (companies.length === 0 && /文物点|文物场所|古迹|遗址|文物/.test(text)) {
            // 查找文物点名称，通常在括号内
            const relicPatterns = [
                /[（(]([^）)]*文物点[^）)]*)[）)]/g,
                /[（(]([^）)]*古迹[^）)]*)[）)]/g,
                /[（(]([^）)]*遗址[^）)]*)[）)]/g,
                /[（(]([^）)]*(?:故居|考棚|记碑|孔庙|城墙|公祠|庙宇|纪念馆|墓)[^）)]*)[）)]/g
            ];
            
            relicPatterns.forEach(pattern => {
                let match;
                while ((match = pattern.exec(text)) !== null) {
                    const relicContent = match[1].trim();
                    // 使用多种分隔符分割文物点名称
                    const separators = /[，,、；;\/]/;
                    const names = relicContent.split(separators)
                        .map(name => name.trim())
                        .filter(name => name && name.length > 0);
                    
                    names.forEach(name => {
                        // 清理末尾的标点符号
                        const cleanName = name.replace(/[，,、；;。.！!？?）)】」]$/, '').trim();
                        if (cleanName.length > 0 && cleanName.length < 50) {
                            companies.push(cleanName);
                        }
                    });
                }
            });
        }
        
        // 特殊处理：处理文物点在括号外的情况
        if (/文物点|文物场所|古迹|遗址|文物/.test(text)) {
            // 查找文物点名称，通常在括号内
            const relicPatterns = [
                /[（(]([^）)]+)[）)]/g,  // 中英文括号内的内容
                /[【]([^】]+)[】]/g,      // 方括号内的内容
            ];
            
            relicPatterns.forEach(pattern => {
                let match;
                while ((match = pattern.exec(text)) !== null) {
                    const relicContent = match[1].trim();
                    // 如果内容包含文物相关关键词
                    if (/(?:故居|考棚|记碑|孔庙|城墙|公祠|庙宇|古迹|文物|遗址|纪念馆|墓|溪桥)/.test(relicContent)) {
                        // 使用多种分隔符分割文物点名称
                        const separators = /[，,、；;\/]/;
                        const names = relicContent.split(separators)
                            .map(name => name.trim())
                            .filter(name => name && name.length > 0);
                        
                        names.forEach(name => {
                            // 清理末尾的标点符号
                            const cleanName = name.replace(/[，,、；;。.！!？?）)】」]$/, '').trim();
                            // 如果名称包含文物相关关键词，则添加
                            if (/(?:故居|考棚|记碑|孔庙|城墙|公祠|庙宇|古迹|文物|遗址|纪念馆|墓|溪桥)/.test(cleanName)) {
                                // 检查是否已存在，避免重复
                                if (!companies.includes(cleanName)) {
                                    companies.push(cleanName);
                                }
                            }
                        });
                    }
                }
            });
        }
        
        // 特殊处理：针对用户最初报告的问题文本格式进行优化
        // 例如："巡查1家网吧（守望之海），2处文物点（五显第一溪桥、叶鹤墓）"
        // 或者："3家游泳场所和3家卫星电视接收设施（万豪、万丽、波特曼）"
        try {
            // 匹配括号前有数量描述的模式
            const specialPattern = /[，,]?[\d]+[处家][^，,]*[（(]([^）)]+)[）)]/g;
            let specialMatch;
            while ((specialMatch = specialPattern.exec(text)) !== null) {
                const content = specialMatch[1].trim();
                // 使用多种分隔符分割名称
                const separators = /[，,、；;\/]/;
                const names = content.split(separators)
                    .map(name => name.trim())
                    .filter(name => name && name.length > 0);
                
                names.forEach(name => {
                    // 清理末尾的标点符号
                    const cleanName = name.replace(/[，,、；;。.！!？?）)】」]$/, '').trim();
                    if (cleanName.length > 0 && cleanName.length < 50) {
                        // 检查是否已存在，避免重复
                        if (!companies.includes(cleanName)) {
                            companies.push(cleanName);
                        }
                    }
                });
            }
        } catch (e) {
            console.warn('特殊模式匹配出错:', e);
        }
        
        // 最后检查：如果仍未识别到企业，但文本中包含括号内容，则尝试提取括号内的所有内容
        try {
            if (companies.length === 0) {
                const bracketPattern = /[（(]([^）)]+)[）)]/g;
                let bracketMatch;
                while ((bracketMatch = bracketPattern.exec(text)) !== null) {
                    const content = bracketMatch[1].trim();
                    // 使用多种分隔符分割名称
                    const separators = /[，,、；;\/]/;
                    const names = content.split(separators)
                        .map(name => name.trim())
                        .filter(name => name && name.length > 0);
                    
                    names.forEach(name => {
                        // 清理末尾的标点符号
                        const cleanName = name.replace(/[，,、；;。.！!？?）)】」]$/, '').trim();
                        // 放宽条件，只要名称长度合适就添加
                        // 同时确保名称不包含明显的非企业名称词汇
                        if (cleanName.length >= 2 && cleanName.length <= 30 && 
                            !/^[\d]+$/.test(cleanName) &&  // 不是纯数字
                            !/异常|情况|问题|正常|良好|发现|检查|巡查|执法/.test(cleanName)  // 不包含动作词汇
                        ) {
                            // 检查是否已存在，避免重复
                            if (!companies.includes(cleanName)) {
                                companies.push(cleanName);
                            }
                        }
                    });
                }
            }
        } catch (e) {
            console.warn('括号内容处理出错:', e);
        }

        return [...new Set(companies)]; // 去重
    }

    // 提取数量信息
    extractQuantities(text) {
        const quantities = [];

        // 特别处理用户报告的问题格式："3家游泳场所和3家卫星电视接收设施"
        // 这种格式需要累加两个数量
        const specialPattern = /(\d+)家[^，,]*[和与、]\s*(\d+)家/;
        const specialMatch = text.match(specialPattern);
        if (specialMatch) {
            // 提取两个数量并累加
            const quantity1 = parseInt(specialMatch[1]);
            const quantity2 = parseInt(specialMatch[2]);
            if (!isNaN(quantity1) && quantity1 > 0) {
                quantities.push(quantity1);
            }
            if (!isNaN(quantity2) && quantity2 > 0) {
                quantities.push(quantity2);
            }
        }

        // 扩展数量正则表达式，包括文物场所等专门表达
        const extendedQuantityPatterns = [
            /共(\d+)家/g,
            /总计(\d+)家/g,
            /(\d+)家企业/g,
            /检查了(\d+)家/g,
            /检查(\d+)家/g,
            /(\d+)户/g,
            // 文物场所特殊表达
            /(\d+)处文物场所/g,
            /(\d+)处文物/g,
            /(\d+)处[古迹文物]/g,
            // 其他常见表达
            /(\d+)处/g,
            /(\d+)个/g,
            /(\d+)家/g
        ];

        extendedQuantityPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                const num = parseInt(match[1]);
                if (!isNaN(num) && num > 0) {
                    // 避免重复添加已通过特殊处理提取的数量
                    if (!quantities.includes(num)) {
                        quantities.push(num);
                    }
                }
            }
        });

        return quantities;
    }

    // 提取人员数量
    extractStaffCounts(text) {
        const staffCounts = [];

        this.staffPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                const num = parseInt(match[1]);
                if (!isNaN(num) && num > 0) {
                    staffCounts.push(num);
                }
            }
        });

        return staffCounts;
    }

    // 识别企业类型
    identifyCompanyTypes(text) {
        const types = [];

        // 更精确的企业类型识别逻辑
        for (const [type, keywords] of Object.entries(this.companyTypeKeywords)) {
            for (const keyword of keywords) {
                // 使用更严格的匹配规则，避免误识别
                const regex = new RegExp(`(?<!不|非|异常|问题)${keyword}(?!问题|异常|情况)`, 'g');
                if (regex.test(text)) {
                    // 特殊处理广电类型，避免误识别
                    if (type === '广电') {
                        // 只有在明确提到广播电视相关词汇时才识别为广电
                        if (/(?:广播电视|有线电视|卫星电视|电视接收|广播电台)/.test(text)) {
                            // 但要排除"卫星接收"这种情况，因为"卫星接收"不是广电类型
                            if (!/卫星接收/.test(text)) {
                                types.push(type);
                            }
                        }
                    } else {
                        types.push(type);
                    }
                    break;
                }
            }
        }

        // 特殊处理：根据识别到的企业名称推断企业类型
        try {
            const extractedCompanies = this.extractCompanies(text);
            if (extractedCompanies.length > 0) {
                extractedCompanies.forEach(company => {
                    // 根据企业名称中的关键词推断类型
                    try {
                        for (const [type, keywords] of Object.entries(this.companyTypeKeywords)) {
                            // 检查企业名称是否包含该类型的关键字
                            const hasKeyword = keywords.some(keyword => company.includes(keyword));
                            if (hasKeyword && !types.includes(type)) {
                                // 特殊处理广电类型
                                if (type === '广电') {
                                    // 只有在明确提到广播电视相关词汇时才识别为广电
                                    if (/(?:广播电视|有线电视|卫星电视|电视接收|广播电台)/.test(company)) {
                                        // 但要排除"卫星接收"这种情况
                                        if (!/卫星接收/.test(company)) {
                                            types.push(type);
                                        }
                                    }
                                } else {
                                    types.push(type);
                                }
                            }
                        }
                    } catch (e) {
                        console.warn('企业类型关键词检查出错:', e);
                    }
                });
            }
        } catch (e) {
            console.warn('企业类型推断出错:', e);
        }
        
        // 特殊处理：根据文本中的数量词推断企业类型
        try {
            if (types.length === 0) {
                if (/文物点|文物场所|古迹|遗址|文物/.test(text)) {
                    types.push('文物');
                }
                if (/KTV|歌厅|夜总会|酒吧/.test(text)) {
                    types.push('娱乐');
                }
                if (/网吧|网咖/.test(text)) {
                    types.push('网吧');
                }
                if (/游戏厅|电玩/.test(text)) {
                    types.push('游艺');
                }
                if (/影院|电影院|影城/.test(text)) {
                    types.push('影院');
                }
                // 更严格的广电类型识别，排除卫星接收
                if (/(?:广播电视|有线电视|电视接收|广播电台)/.test(text) && !/卫星接收/.test(text)) {
                    types.push('广电');
                }
            }
        } catch (e) {
            console.warn('企业类型推断出错:', e);
        }

        // 特殊处理：如果文本中包含"卫星电视接收设施"或"卫星接收"，应该识别为"卫星接收"类型
        // 并确保不错误地识别为"广电"类型
        if (/(?:卫星电视接收设施|卫星接收)/.test(text)) {
            // 移除可能错误识别的"广电"类型
            const guangDianIndex = types.indexOf('广电');
            if (guangDianIndex > -1) {
                types.splice(guangDianIndex, 1);
            }
            
            // 添加"卫星接收"类型（如果还没有的话）
            if (!types.includes('卫星接收')) {
                types.push('卫星接收');
            }
        }

        return [...new Set(types)]; // 去重
    }

    // 验证日期有效性
    isValidDate(dateStr) {
        const date = new Date(dateStr);
        return date instanceof Date && !isNaN(date.getTime());
    }

    // 智能提取检查信息汇总
    extractInspectionSummary(text) {
        // 确保输入文本为字符串类型，避免undefined或null值
        const safeText = text ? text.toString().trim() : '';
        if (!safeText) {
            return {
                date: new Date().toISOString().split('T')[0],
                extractedCompanies: [],
                identifiedTypes: [],
                totalCompanies: 0,
                totalStaff: 0,
                confidence: 0
            };
        }
        
        const analysis = this.analyzeInspectionText(safeText);

        // 推断检查日期（取最近的日期或最常出现的日期）
        const inferredDate = analysis.dates.length > 0
            ? analysis.dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
            : new Date().toISOString().split('T')[0];

        // 推断企业总数
        // 优先使用文本中明确提到的数量，如果没有则使用识别到的企业数量
        let inferredCompanyCount = analysis.companies.length; // 默认使用识别到的企业数量
        
        // 查找更准确的数量信息
        if (analysis.quantities.length > 0) {
            // 特殊处理：对于用户报告的问题文本格式，需要特别处理
            // 例如："3家游泳场所和3家卫星电视接收设施（万豪、万丽、波特曼）"
            // 这种情况下需要累加不同类型的数量
            try {
                // 检查是否有多个数量表达式
                const multipleQuantityPattern = /(\d+)家[^，,]*[和与、]\s*(\d+)家/;
                const multipleMatch = safeText.match(multipleQuantityPattern);
                if (multipleMatch) {
                    // 累加多个数量
                    const quantity1 = parseInt(multipleMatch[1]);
                    const quantity2 = parseInt(multipleMatch[2]);
                    inferredCompanyCount = quantity1 + quantity2;
                }
            } catch (e) {
                console.warn('特殊数量处理出错:', e);
            }
            
            // 如果仍未确定数量，则使用其他数量信息
            if (inferredCompanyCount === 0) {
                const reasonableQuantities = analysis.quantities.filter(q => q > 0 && q <= 100);
                if (reasonableQuantities.length > 0) {
                    // 如果识别到的企业数量为0，但有数量信息，则使用数量信息
                    if (inferredCompanyCount === 0) {
                        inferredCompanyCount = Math.max(...reasonableQuantities);
                    } else {
                        // 如果既有识别到的企业，又有数量信息
                        // 对于文物场所，优先使用明确提到的文物点数量
                        if (analysis.companyTypes.includes('文物')) {
                            const relicQuantities = analysis.quantities.filter(q => q > 0 && q <= 50 && q >= analysis.companies.length);
                            if (relicQuantities.length > 0) {
                                inferredCompanyCount = Math.max(...relicQuantities);
                            } else {
                                inferredCompanyCount = Math.max(inferredCompanyCount, Math.max(...reasonableQuantities));
                            }
                        } else {
                            // 对于非文物场所，选择较大的值
                            inferredCompanyCount = Math.max(inferredCompanyCount, Math.max(...reasonableQuantities));
                        }
                    }
                }
            }
        }
        
        // 特殊处理文物场所的情况
        try {
            if (analysis.companyTypes.includes('文物') && inferredCompanyCount === 0 && analysis.quantities.length > 0) {
                // 对于文物场所，通常会明确提到检查了多少处
                const relicQuantities = analysis.quantities.filter(q => q > 0 && q <= 50);
                if (relicQuantities.length > 0) {
                    inferredCompanyCount = Math.max(...relicQuantities);
                }
            }
        } catch (e) {
            console.warn('文物场所数量处理出错:', e);
        }
        
        // 特殊处理：对于"3家游泳场所和3家卫星电视接收设施（万豪、万丽、波特曼）"这种格式
        // 需要确保识别到的企业数量与总数量一致
        try {
            // 检查是否是"X家A和Y家B（企业列表）"这种格式
            const pattern = /(\d+)家[^，,（(]*[和与、]\s*(\d+)家[^，,（(]*/;
            const match = safeText.match(pattern);
            if (match) {
                // 在这种情况下，企业列表中的每个企业可能对应多个实际企业
                // 例如："万豪"可能对应"万豪酒店分公司室内游泳池"和"万豪酒店分公司卫星接收"两个企业
                const expectedTotal = parseInt(match[1]) + parseInt(match[2]);
                if (expectedTotal > inferredCompanyCount) {
                    inferredCompanyCount = expectedTotal;
                }
            }
            
            // 特殊处理：对于括号内的企业列表，每个简短名称可能对应多个企业
            // 例如：（万豪、万丽、波特曼）中的每个名称可能对应多个企业
            if (analysis.companies.length > 0 && inferredCompanyCount > 0) {
                // 如果识别到的企业数量少于计算的总数，可能需要进一步处理
                if (analysis.companies.length < inferredCompanyCount) {
                    // 检查是否是简短名称格式
                    const hasShortNames = analysis.companies.some(name => name.length <= 4);
                    if (hasShortNames) {
                        // 对于简短名称，每个名称可能对应多个企业
                        // 这里我们假设每个简短名称平均对应2个企业
                        const estimatedTotal = analysis.companies.length * 2;
                        if (estimatedTotal >= inferredCompanyCount) {
                            inferredCompanyCount = estimatedTotal;
                        }
                    }
                }
            }
        } catch (e) {
            console.warn('企业数量一致性检查出错:', e);
        }
        
        // 推断人员总数
        let inferredStaffCount = 0;
        if (analysis.staffCounts.length > 0) {
            // 优先使用明确提到的人员数量
            inferredStaffCount = Math.max(...analysis.staffCounts);
        } else {
            // 根据企业数量推断（使用系统配置的倍数）
            const config = db.getSystemConfig();
            const multiplier = config.defaultStaffMultiplier || 3;
            inferredStaffCount = inferredCompanyCount * multiplier;
        }
        
        return {
            date: inferredDate,
            extractedCompanies: analysis.companies,
            identifiedTypes: analysis.companyTypes,
            totalCompanies: inferredCompanyCount,
            totalStaff: inferredStaffCount,
            confidence: this.calculateConfidence(analysis, safeText)
        };
    }

    // 计算识别置信度
    calculateConfidence(analysis, originalText = '') {
        let score = 0;

        if (analysis.dates.length > 0) score += 30;
        if (analysis.quantities.length > 0) score += 25;
        if (analysis.companies.length > 0) {
            score += 25;
            // 如果企业名称是从括号内提取的，给予额外加分
            if (originalText && /[（(].*[）)]/.test(originalText)) {
                score += 10; // 括号内容加分
            }
        }
        if (analysis.staffCounts.length > 0) score += 20;
        
        // 根据企业类型识别情况加分
        if (analysis.companyTypes.length > 0) score += 10;
        
        // 根据识别到的企业数量加分（数量越多，置信度越高，但有上限）
        score += Math.min(analysis.companies.length * 2, 20);
        
        // 特殊加分：如果同时识别到企业名称和类型，给予额外加分
        if (analysis.companies.length > 0 && analysis.companyTypes.length > 0) {
            score += 10;
        }
        
        // 特殊加分：如果识别到的企业数量与文本中提到的数量一致，给予额外加分
        try {
            if (analysis.quantities.length > 0 && analysis.companies.length > 0) {
                const maxQuantity = Math.max(...analysis.quantities);
                if (Math.abs(analysis.companies.length - maxQuantity) <= 1) { // 允许1个的误差
                    score += 10;
                }
            }
        } catch (e) {
            console.warn('数量一致性检查出错:', e);
        }

        return Math.min(100, score);
    }
}

// Excel 处理工具类
class ExcelHelper {
    // 将数据转换为CSV格式
    static toCsv(data, headers) {
        const csvHeaders = headers.join(',');
        const csvRows = data.map(row =>
            headers.map(header => {
                let value = row[header] !== undefined && row[header] !== null ? row[header] : '';
                // 清理值中的不可见字符
                if (typeof value === 'string') {
                    value = value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
                }
                // 处理包含逗号或换行的值
                if (typeof value === 'string' && (value.includes(',') || value.includes('\n'))) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            }).join(',')
        );

        return [csvHeaders, ...csvRows].join('\n');
    }

    // 下载CSV文件
    static downloadCsv(data, headers, filename) {
        const csv = this.toCsv(data, headers);
        // 添加BOM以确保UTF-8编码被正确识别
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');

        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    // 下载Excel文件 (xlsx格式)
    static downloadExcel(data, headers, filename, format = 'xlsx') {
        // 确保xlsx库已加载
        if (typeof XLSX === 'undefined') {
            console.error('XLSX library is not loaded');
            // 如果xlsx库未加载，回退到CSV格式
            this.downloadCsv(data, headers, filename.replace('.xlsx', '.csv').replace('.xls', '.csv'));
            return;
        }

        try {
            // 创建工作簿
            const wb = XLSX.utils.book_new();
            
            // 转换数据格式
            const wsData = [headers, ...data.map(row => headers.map(header => row[header] !== undefined && row[header] !== null ? row[header] : ''))];
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            
            // 添加工作表到工作簿
            XLSX.utils.book_append_sheet(wb, ws, '数据');
            
            // 生成Excel文件并下载
            if (format === 'xls') {
                // 导出为XLS格式
                XLSX.writeFile(wb, filename, { bookType: 'xls' });
            } else {
                // 默认导出为XLSX格式
                XLSX.writeFile(wb, filename, { bookType: 'xlsx' });
            }
        } catch (error) {
            console.error('导出Excel文件时出错:', error);
            // 如果导出失败，回退到CSV格式
            this.downloadCsv(data, headers, filename.replace('.xlsx', '.csv').replace('.xls', '.csv'));
        }
    }

    // 根据文件扩展名下载相应格式的文件
    static download(data, headers, filename) {
        if (filename.toLowerCase().endsWith('.xlsx')) {
            this.downloadExcel(data, headers, filename, 'xlsx');
        } else if (filename.toLowerCase().endsWith('.xls')) {
            this.downloadExcel(data, headers, filename, 'xls');
        } else {
            this.downloadCsv(data, headers, filename);
        }
    }

    // 生成Excel模板
    static generateTemplate(headers, filename) {
        const data = [{}]; // 空行
        // 确保生成UTF-8编码的CSV模板
        const csvContent = this.toCsv(data, headers);
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');

        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }
}

// 日期工具类
class DateHelper {
    // 格式化日期
    static formatDate(date, format = 'YYYY-MM-DD') {
        let d;
        if (typeof date === 'string') {
            // 对于字符串日期，先尝试解析为Date对象
            d = new Date(date);
            // 如果解析失败，尝试其他格式
            if (isNaN(d.getTime())) {
                // 尝试解析YYYY-MM-DD格式
                const parts = date.split('-');
                if (parts.length === 3) {
                    d = new Date(parts[0], parseInt(parts[1]) - 1, parts[2]);
                }
            }
        } else {
            d = date;
        }

        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');

        return format
            .replace('YYYY', year.toString())
            .replace('MM', month)
            .replace('DD', day);
    }

    // 将Excel日期序列号转换为标准日期格式
    static convertExcelDate(serial) {
        // Excel的日期序列号从1900年1月1日开始计算（序列号为1）
        // 但是Excel有一个bug，认为1900年是闰年，所以需要特殊处理
        if (typeof serial === 'number') {
            // 使用固定的日期计算方式，避免时区问题
            // 1900年1月1日是星期一，序列号为1
            // 需要考虑Excel的1900年闰年bug
            
            if (serial === 60) {
                // 60是不存在的日期（1900年2月29日），但Excel认为它存在
                // 我们将其转换为1900年2月28日
                return '1900-02-28';
            }
            
            // 计算基准日期：1900年1月1日
            let year = 1900;
            let month = 0; // 0表示1月
            let day = 1;
            
            // 减去1，因为序列号1对应1900年1月1日
            let daysRemaining = serial - 1;
            
            // 如果序列号大于等于60，需要补偿Excel的闰年bug
            if (serial >= 60) {
                daysRemaining -= 1;
            }
            
            // 手动计算日期，避免时区问题
            const date = new Date(year, month, day);
            date.setDate(date.getDate() + daysRemaining);
            
            // 格式化日期
            const resultYear = date.getFullYear();
            const resultMonth = String(date.getMonth() + 1).padStart(2, '0');
            const resultDay = String(date.getDate()).padStart(2, '0');
            
            return `${resultYear}-${resultMonth}-${resultDay}`;
        }
        return serial;
    }

    // 获取日期范围内的所有日期
    static getDateRange(startDate, endDate) {
        const dates = [];
        const start = new Date(startDate);
        const end = new Date(endDate);

        // 使用UTC日期避免时区问题
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            // 确保日期部分不变，避免时区影响
            const utcDate = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
            dates.push(this.formatDate(utcDate));
        }

        return dates;
    }

    // 获取月份范围
    static getMonthRange(year) {
        const months = [];
        for (let i = 1; i <= 12; i++) {
            const month = String(i).padStart(2, '0');
            months.push({
                label: `${year}年${i}月`,
                value: `${year}-${month}`
            });
        }
        return months;
    }

    // 获取年度范围
    static getYearRange(startYear, endYear) {
        const currentYear = new Date().getFullYear();
        const start = startYear || currentYear - 5;
        const end = endYear || currentYear + 1;

        const years = [];
        for (let year = start; year <= end; year++) {
            years.push(year);
        }
        return years;
    }
}

// 表单验证工具类
class ValidationHelper {
    // 验证企业信息
    static validateCompany(company) {
        const errors = [];

        if (!company.name || company.name.trim() === '') {
            errors.push('企业名称不能为空');
        }

        if (!company.type || company.type.trim() === '') {
            errors.push('企业类型不能为空');
        }

        if (company.creditCode && !/^[0-9A-HJ-NPQRTUWXY]{2}\d{6}[0-9A-HJ-NPQRTUWXY]{10}$/.test(company.creditCode)) {
            errors.push('统一社会信用代码格式不正确');
        }

        return errors;
    }

    // 验证人员信息
    static validateStaff(staff) {
        const errors = [];

        if (!staff.name || staff.name.trim() === '') {
            errors.push('姓名不能为空');
        }

        if (staff.phone && !/^1[3-9]\d{9}$/.test(staff.phone)) {
            errors.push('手机号码格式不正确');
        }

        if (!staff.departmentId || staff.departmentId.trim() === '') {
            errors.push('所在科室不能为空');
        }

        return errors;
    }

    // 验证检查记录
    static validateInspectionRecord(record) {
        const errors = [];

        if (!record.date || record.date.trim() === '') {
            errors.push('检查日期不能为空');
        }

        if (!record.companies || record.companies.length === 0) {
            errors.push('检查企业不能为空');
        }

        if (!record.totalCompanies || record.totalCompanies <= 0) {
            errors.push('检查企业总数必须大于0');
        }

        if (!record.totalStaff || record.totalStaff <= 0) {
            errors.push('出动人员数量必须大于0');
        }

        return errors;
    }
}

// 统计工具类
class StatisticsHelper {
    // 生成统计报告
    static generateReport(inspections, companies, staff, startDate, endDate) {
        const filteredInspections = inspections.filter(inspection =>
            inspection.date >= startDate && inspection.date <= endDate
        );

        const totalInspections = filteredInspections.length;
        const totalCompaniesInspected = filteredInspections.reduce((sum, inspection) => sum + inspection.totalCompanies, 0);
        const totalStaffDeployed = filteredInspections.reduce((sum, inspection) => sum + inspection.totalStaff, 0);

        // 按企业类型统计
        const byCompanyType = {};
        filteredInspections.forEach(inspection => {
            inspection.companies.forEach(company => {
                if (!byCompanyType[company.companyType]) {
                    byCompanyType[company.companyType] = 0;
                }
                byCompanyType[company.companyType]++;
            });
        });

        // 按人员统计
        const byStaff = {};
        filteredInspections.forEach(inspection => {
            inspection.staffIds.forEach(staffId => {
                const staffMember = staff.find(s => s.id === staffId);
                if (staffMember) {
                    if (!byStaff[staffMember.name]) {
                        byStaff[staffMember.name] = 0;
                    }
                    byStaff[staffMember.name]++;
                }
            });
        });

        return {
            period: `${startDate} 至 ${endDate}`,
            totalInspections,
            totalCompaniesInspected,
            totalStaffDeployed,
            byCompanyType,
            byStaff,
            avgCompaniesPerInspection: totalInspections > 0 ? (totalCompaniesInspected / totalInspections).toFixed(2) : 0,
            avgStaffPerInspection: totalInspections > 0 ? (totalStaffDeployed / totalInspections).toFixed(2) : 0
        };
    }
}

// 创建全局实例
const textAnalyzer = new TextAnalyzer();