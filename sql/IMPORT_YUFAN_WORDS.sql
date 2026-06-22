-- ============================================================================
-- Import Yufan's vocabulary (119 words, June 11–21 2026)
-- Source: Yufan's Vocabulary/Sheet 1-Table 1.csv
--
-- Spelling corrections from original notes:
--   "imput"          → "input"
--   "industructible" → "indestructible"
--   "presense"       → "presence"
--   "enbed"          → "embed"
--
-- IPA, English definitions, and Chinese translations added from reference sources.
-- Categories: technology (June 15–21), science (June 11–14)
--
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================================

DO $$
DECLARE
    yufan_id uuid := '770b9971-0003-4497-9c09-2ac42879f8a6';
BEGIN

INSERT INTO words (user_id, word, ipa, part_of_speech, english_definition, chinese_definition, category, created_at, updated_at)
VALUES

-- ── June 21, 2026 — technology ──────────────────────────────────────────────
(yufan_id, 'refer',        '/rɪˈfɜːr/',      'verb',        'to mention or direct attention to something',                           '提及；参考',       'technology', '2026-06-21T12:00:00Z', '2026-06-21T12:00:00Z'),
(yufan_id, 'binary',       '/ˈbaɪnəri/',     'adjective',   'relating to a number system that uses only 0 and 1',                    '二进制的',         'technology', '2026-06-21T12:00:00Z', '2026-06-21T12:00:00Z'),
(yufan_id, 'imitate',      '/ˈɪmɪteɪt/',     'verb',        'to copy the actions or speech of someone or something',                 '模仿',             'technology', '2026-06-21T12:00:00Z', '2026-06-21T12:00:00Z'),
(yufan_id, 'grid',         '/ɡrɪd/',         'noun',        'a pattern of evenly spaced horizontal and vertical lines',              '网格',             'technology', '2026-06-21T12:00:00Z', '2026-06-21T12:00:00Z'),
(yufan_id, 'scanner',      '/ˈskænər/',      'noun',        'a device that reads images or barcodes and converts them to digital data','扫描仪',          'technology', '2026-06-21T12:00:00Z', '2026-06-21T12:00:00Z'),
(yufan_id, 'natation',     '/nəˈteɪʃən/',    'noun',        'the action or art of swimming',                                         '游泳',             'technology', '2026-06-21T12:00:00Z', '2026-06-21T12:00:00Z'),
(yufan_id, 'shade',        '/ʃeɪd/',         'noun',        'comparative darkness caused by shelter from direct sunlight',           '阴影；背阴处',     'technology', '2026-06-21T12:00:00Z', '2026-06-21T12:00:00Z'),
(yufan_id, 'column',       '/ˈkɒləm/',       'noun',        'a vertical series of items in a table or spreadsheet',                  '列；纵栏',         'technology', '2026-06-21T12:00:00Z', '2026-06-21T12:00:00Z'),
(yufan_id, 'visually',     '/ˈvɪʒuəli/',     'adverb',      'in a way that relates to sight or visual appearance',                   '视觉上',           'technology', '2026-06-21T12:00:00Z', '2026-06-21T12:00:00Z'),
(yufan_id, 'Spanish',      '/ˈspænɪʃ/',      'adjective',   'relating to Spain, its people, or its language',                       '西班牙的',         'technology', '2026-06-21T12:00:00Z', '2026-06-21T12:00:00Z'),
(yufan_id, 'readable',     '/ˈriːdəbəl/',    'adjective',   'clear and easy to read or understand',                                  '易读的；可读性强的','technology', '2026-06-21T12:00:00Z', '2026-06-21T12:00:00Z'),
(yufan_id, 'thumbprint',   '/ˈθʌmprɪnt/',    'noun',        'an impression made by a thumb, used for identification',                '拇指指纹',         'technology', '2026-06-21T12:00:00Z', '2026-06-21T12:00:00Z'),

-- ── June 20, 2026 — technology ──────────────────────────────────────────────
(yufan_id, 'console',       '/ˈkɒnsəʊl/',     'noun',        'a panel or unit holding controls for electronic equipment',             '控制台',           'technology', '2026-06-20T12:00:00Z', '2026-06-20T12:00:00Z'),
(yufan_id, 'upload',        '/ˈʌpləʊd/',      'verb',        'to transfer data from a local computer to a server or the cloud',       '上传',             'technology', '2026-06-20T12:00:00Z', '2026-06-20T12:00:00Z'),
(yufan_id, 'keypad',        '/ˈkiːpæd/',      'noun',        'a small keyboard or set of buttons used to enter data',                 '小键盘',           'technology', '2026-06-20T12:00:00Z', '2026-06-20T12:00:00Z'),
(yufan_id, 'format',        '/ˈfɔːmæt/',      'noun',        'the way in which data or a document is arranged or structured',         '格式；格局',       'technology', '2026-06-20T12:00:00Z', '2026-06-20T12:00:00Z'),
(yufan_id, 'chunk',         '/tʃʌŋk/',        'noun',        'a thick or large piece or portion of something',                        '大块；组块',       'technology', '2026-06-20T12:00:00Z', '2026-06-20T12:00:00Z'),
(yufan_id, 'reconstruct',   '/ˌriːkənˈstrʌkt/','verb',       'to build or create something again after it has been damaged or lost',  '重建；复原',       'technology', '2026-06-20T12:00:00Z', '2026-06-20T12:00:00Z'),
(yufan_id, 'encode',        '/ɪnˈkəʊd/',      'verb',        'to convert information into a coded form for storage or transmission',  '编码',             'technology', '2026-06-20T12:00:00Z', '2026-06-20T12:00:00Z'),
(yufan_id, 'wire',          '/waɪər/',        'noun',        'a thin metal thread used to carry electric current',                    '电线；导线',       'technology', '2026-06-20T12:00:00Z', '2026-06-20T12:00:00Z'),
(yufan_id, 'decode',        '/ˌdiːˈkəʊd/',    'verb',        'to convert a coded message or signal back into understandable form',    '解码；破译',       'technology', '2026-06-20T12:00:00Z', '2026-06-20T12:00:00Z'),
(yufan_id, 'understandable','/ˌʌndəˈstændəbəl/','adjective', 'able to be understood; natural and reasonable in the circumstances',   '可理解的；合情理的','technology', '2026-06-20T12:00:00Z', '2026-06-20T12:00:00Z'),
(yufan_id, 'scheme',        '/skiːm/',        'noun',        'a plan or system designed to achieve a particular goal',                '方案；计划',       'technology', '2026-06-20T12:00:00Z', '2026-06-20T12:00:00Z'),
(yufan_id, 'communication', '/kəˌmjuːnɪˈkeɪʃən/','noun',    'the sharing of information between people or systems',                  '通信；交流',       'technology', '2026-06-20T12:00:00Z', '2026-06-20T12:00:00Z'),

-- ── June 19, 2026 — technology ──────────────────────────────────────────────
(yufan_id, 'focus',         '/ˈfəʊkəs/',      'verb',        'to concentrate attention or effort on something',                       '聚焦；集中',       'technology', '2026-06-19T12:00:00Z', '2026-06-19T12:00:00Z'),
(yufan_id, 'satellite',     '/ˈsætəlaɪt/',    'noun',        'a device placed in orbit around Earth to relay signals or gather data', '卫星；人造卫星',   'technology', '2026-06-19T12:00:00Z', '2026-06-19T12:00:00Z'),
(yufan_id, 'twitter',       '/ˈtwɪtər/',      'verb',        'to make a series of light, rapid, high-pitched sounds; to chatter',    '叽喳叫；喋喋不休', 'technology', '2026-06-19T12:00:00Z', '2026-06-19T12:00:00Z'),
(yufan_id, 'guidance',      '/ˈɡaɪdəns/',     'noun',        'advice or information aimed at helping someone make good decisions',    '指导；引导',       'technology', '2026-06-19T12:00:00Z', '2026-06-19T12:00:00Z'),
(yufan_id, 'radar',         '/ˈreɪdɑːr/',     'noun',        'a system using radio waves to detect the position and speed of objects','雷达',             'technology', '2026-06-19T12:00:00Z', '2026-06-19T12:00:00Z'),
(yufan_id, 'lidar',         '/ˈlaɪdɑːr/',     'noun',        'a detection system that uses laser pulses to measure distances',        '激光雷达',         'technology', '2026-06-19T12:00:00Z', '2026-06-19T12:00:00Z'),
(yufan_id, 'ultrasonic',    '/ˌʌltrəˈsɒnɪk/', 'adjective',   'relating to sound waves with a frequency above the range of human hearing','超声波的',      'technology', '2026-06-19T12:00:00Z', '2026-06-19T12:00:00Z'),
(yufan_id, 'external',      '/ɪkˈstɜːnəl/',   'adjective',   'relating to or situated on the outside; coming from outside',          '外部的；外来的',   'technology', '2026-06-19T12:00:00Z', '2026-06-19T12:00:00Z'),
(yufan_id, 'temporary',     '/ˈtempərəri/',   'adjective',   'lasting for only a limited period of time; not permanent',              '临时的；暂时的',   'technology', '2026-06-19T12:00:00Z', '2026-06-19T12:00:00Z'),
(yufan_id, 'unorganized',   '/ʌnˈɔːɡənaɪzd/', 'adjective',   'not arranged in a systematic or orderly manner',                       '无组织的；杂乱的', 'technology', '2026-06-19T12:00:00Z', '2026-06-19T12:00:00Z'),
(yufan_id, 'average',       '/ˈævərɪdʒ/',     'adjective',   'typical or ordinary; a value calculated by dividing the total by the count','平均的；普通的','technology', '2026-06-19T12:00:00Z', '2026-06-19T12:00:00Z'),
(yufan_id, 'press',         '/pres/',         'verb',        'to push firmly against something with force',                           '按；压',           'technology', '2026-06-19T12:00:00Z', '2026-06-19T12:00:00Z'),

-- ── June 18, 2026 — technology ──────────────────────────────────────────────
(yufan_id, 'debug',          '/ˌdiːˈbʌɡ/',     'verb',        'to identify and fix errors or faults in a computer program',            '调试；除错',       'technology', '2026-06-18T12:00:00Z', '2026-06-18T12:00:00Z'),
(yufan_id, 'bug',            '/bʌɡ/',          'noun',        'an error or defect in a computer program that causes unexpected behavior','程序错误；故障',  'technology', '2026-06-18T12:00:00Z', '2026-06-18T12:00:00Z'),
(yufan_id, 'typo',           '/ˈtaɪpəʊ/',      'noun',        'a small mistake made while typing',                                     '打字错误',         'technology', '2026-06-18T12:00:00Z', '2026-06-18T12:00:00Z'),
(yufan_id, 'troubleshooter', '/ˈtrʌbəlʃuːtər/','noun',        'a person who investigates and solves problems or faults',               '故障排查员',       'technology', '2026-06-18T12:00:00Z', '2026-06-18T12:00:00Z'),
(yufan_id, 'swapping',       '/ˈswɒpɪŋ/',      'verb',        'exchanging one thing for another',                                      '交换；替换',       'technology', '2026-06-18T12:00:00Z', '2026-06-18T12:00:00Z'),
(yufan_id, 'motherboard',    '/ˈmʌðəbɔːd/',    'noun',        'the main circuit board of a computer that connects all components',     '主板',             'technology', '2026-06-18T12:00:00Z', '2026-06-18T12:00:00Z'),
(yufan_id, 'update',         '/ˈʌpdeɪt/',      'verb',        'to make something more current by adding new information or features',  '更新',             'technology', '2026-06-18T12:00:00Z', '2026-06-18T12:00:00Z'),
(yufan_id, 'install',        '/ɪnˈstɔːl/',     'verb',        'to set up software or hardware so it is ready for use',                 '安装',             'technology', '2026-06-18T12:00:00Z', '2026-06-18T12:00:00Z'),
(yufan_id, 'compatibility',  '/kəmˌpætɪˈbɪlɪti/','noun',     'the ability of different systems or software to work together without conflict','兼容性',     'technology', '2026-06-18T12:00:00Z', '2026-06-18T12:00:00Z'),
(yufan_id, 'android',        '/ˈændɹɔɪd/',     'noun',        'a robot or machine designed to look and behave like a human',           '人形机器人',       'technology', '2026-06-18T12:00:00Z', '2026-06-18T12:00:00Z'),
(yufan_id, 'issue',          '/ˈɪʃuː/',        'noun',        'a problem or difficulty that needs to be resolved',                     '问题；议题',       'technology', '2026-06-18T12:00:00Z', '2026-06-18T12:00:00Z'),
(yufan_id, 'knowledgeable',  '/ˈnɒlɪdʒəbəl/',  'adjective',   'having or showing a great deal of knowledge or information',            '知识渊博的',       'technology', '2026-06-18T12:00:00Z', '2026-06-18T12:00:00Z'),

-- ── June 17, 2026 — technology ──────────────────────────────────────────────
(yufan_id, 'easier',        '/ˈiːziər/',      'adjective',   'not as difficult; more simple or less effort to accomplish',             '更容易的',         'technology', '2026-06-17T12:00:00Z', '2026-06-17T12:00:00Z'),
(yufan_id, 'interface',     '/ˈɪntəfeɪs/',    'noun',        'a point where two systems meet and interact; a user-facing screen',      '界面；接口',       'technology', '2026-06-17T12:00:00Z', '2026-06-17T12:00:00Z'),
(yufan_id, 'computing',     '/kəmˈpjuːtɪŋ/',  'noun',        'the use and operation of computers to process and store information',    '计算机使用；计算', 'technology', '2026-06-17T12:00:00Z', '2026-06-17T12:00:00Z'),
(yufan_id, 'speaker',       '/ˈspiːkər/',     'noun',        'a device that converts electrical signals into sound',                   '扬声器；喇叭',     'technology', '2026-06-17T12:00:00Z', '2026-06-17T12:00:00Z'),
(yufan_id, 'menu',          '/ˈmenjuː/',      'noun',        'a list of options or commands available in a computer program',          '菜单',             'technology', '2026-06-17T12:00:00Z', '2026-06-17T12:00:00Z'),
(yufan_id, 'pronounce',     '/prəˈnaʊns/',    'verb',        'to make the sounds of a word in the correct way when speaking',         '发音',             'technology', '2026-06-17T12:00:00Z', '2026-06-17T12:00:00Z'),
(yufan_id, 'although',      '/ɔːlˈðəʊ/',      'conjunction', 'in spite of the fact that; even though',                                '虽然；尽管',       'technology', '2026-06-17T12:00:00Z', '2026-06-17T12:00:00Z'),
(yufan_id, 'troubleshoot',  '/ˈtrʌbəlʃuːt/',  'verb',        'to investigate and fix problems in a system or device systematically',   '排除故障',         'technology', '2026-06-17T12:00:00Z', '2026-06-17T12:00:00Z'),
(yufan_id, 'systematic',    '/ˌsɪstəˈmætɪk/', 'adjective',   'done according to a fixed, organized plan or method; methodical',       '系统的；有条理的', 'technology', '2026-06-17T12:00:00Z', '2026-06-17T12:00:00Z'),
(yufan_id, 'within',        '/wɪˈðɪn/',       'preposition', 'inside or not beyond a particular time, area, or limit',                '在…之内',          'technology', '2026-06-17T12:00:00Z', '2026-06-17T12:00:00Z'),
(yufan_id, 'plug',          '/plʌɡ/',         'noun',        'a device for connecting an electrical appliance to a power socket',      '插头；插件',       'technology', '2026-06-17T12:00:00Z', '2026-06-17T12:00:00Z'),
(yufan_id, 'securely',      '/sɪˈkjʊərli/',   'adverb',      'in a way that is firmly fixed, safe, or protected from harm',           '安全地；牢固地',   'technology', '2026-06-17T12:00:00Z', '2026-06-17T12:00:00Z'),

-- ── June 15, 2026 — technology ──────────────────────────────────────────────
(yufan_id, 'complex',       '/ˈkɒmpleks/',    'adjective',   'consisting of many different parts; difficult to understand or deal with','复杂的',          'technology', '2026-06-15T12:00:00Z', '2026-06-15T12:00:00Z'),
(yufan_id, 'profession',    '/prəˈfeʃən/',    'noun',        'a paid occupation that requires special education or training',           '职业；专业',       'technology', '2026-06-15T12:00:00Z', '2026-06-15T12:00:00Z'),
(yufan_id, 'massive',       '/ˈmæsɪv/',       'adjective',   'extremely large in size, amount, or degree',                            '巨大的；大量的',   'technology', '2026-06-15T12:00:00Z', '2026-06-15T12:00:00Z'),
(yufan_id, 'document',      '/ˈdɒkjumənt/',   'noun',        'a piece of written or electronic information that records something',    '文件；文档',       'technology', '2026-06-15T12:00:00Z', '2026-06-15T12:00:00Z'),
(yufan_id, 'hardware',      '/ˈhɑːdweər/',    'noun',        'the physical components of a computer system',                          '硬件',             'technology', '2026-06-15T12:00:00Z', '2026-06-15T12:00:00Z'),
(yufan_id, 'software',      '/ˈsɒftweər/',    'noun',        'the programs and operating systems used by a computer',                  '软件',             'technology', '2026-06-15T12:00:00Z', '2026-06-15T12:00:00Z'),
(yufan_id, 'browser',       '/ˈbraʊzər/',     'noun',        'a program used to access and navigate websites on the internet',         '浏览器',           'technology', '2026-06-15T12:00:00Z', '2026-06-15T12:00:00Z'),
(yufan_id, 'input',         '/ˈɪnpʊt/',       'noun',        'data or information entered into a computer or system',                  '输入',             'technology', '2026-06-15T12:00:00Z', '2026-06-15T12:00:00Z'),
(yufan_id, 'webcam',        '/ˈwebkæm/',      'noun',        'a camera connected to a computer for video streaming or video calls',    '网络摄像头',       'technology', '2026-06-15T12:00:00Z', '2026-06-15T12:00:00Z'),
(yufan_id, 'storage',       '/ˈstɔːrɪdʒ/',    'noun',        'the space available in a computer for saving data or files',             '存储；储存空间',   'technology', '2026-06-15T12:00:00Z', '2026-06-15T12:00:00Z'),
(yufan_id, 'execute',       '/ˈeksɪkjuːt/',   'verb',        'to carry out or run a program or set of instructions on a computer',    '执行；运行',       'technology', '2026-06-15T12:00:00Z', '2026-06-15T12:00:00Z'),
(yufan_id, 'output',        '/ˈaʊtpʊt/',      'noun',        'data or results produced by a computer after processing',                '输出；产出',       'technology', '2026-06-15T12:00:00Z', '2026-06-15T12:00:00Z'),
(yufan_id, 'memory',        '/ˈmemərɪ/',      'noun',        'the part of a computer where data is stored and accessed quickly',       '内存；存储器',     'technology', '2026-06-15T12:00:00Z', '2026-06-15T12:00:00Z'),
(yufan_id, 'projector',     '/prəˈdʒektər/',  'noun',        'a device that displays an image or video on a screen or wall',          '投影仪',           'technology', '2026-06-15T12:00:00Z', '2026-06-15T12:00:00Z'),

-- ── June 14, 2026 — science ─────────────────────────────────────────────────
(yufan_id, 'phase',          '/feɪz/',         'noun',        'a distinct stage in a process of change or development',                '阶段；相位',       'science', '2026-06-14T12:00:00Z', '2026-06-14T12:00:00Z'),
(yufan_id, 'bajillion',      '/bəˈdʒɪliən/',   'noun',        'an extremely large, unspecified number (informal)',                      '天文数字（非正式）','science', '2026-06-14T12:00:00Z', '2026-06-14T12:00:00Z'),
(yufan_id, 'proton',         '/ˈprəʊtɒn/',     'noun',        'a positively charged particle found in the nucleus of every atom',      '质子',             'science', '2026-06-14T12:00:00Z', '2026-06-14T12:00:00Z'),
(yufan_id, 'neutron',        '/ˈnjuːtrɒn/',    'noun',        'a particle in the nucleus of an atom with no electric charge',          '中子',             'science', '2026-06-14T12:00:00Z', '2026-06-14T12:00:00Z'),
(yufan_id, 'indestructible', '/ˌɪndɪˈstrʌktɪbəl/','adjective','too strong to be destroyed or damaged',                                '坚不可摧的',       'science', '2026-06-14T12:00:00Z', '2026-06-14T12:00:00Z'),
(yufan_id, 'presence',       '/ˈprezəns/',     'noun',        'the fact of being in a particular place; the state of existing somewhere','存在；出现',      'science', '2026-06-14T12:00:00Z', '2026-06-14T12:00:00Z'),
(yufan_id, 'negatively',     '/ˈneɡətɪvli/',   'adverb',      'in a way that expresses denial, refusal, or harmful effect',            '负面地；消极地',   'science', '2026-06-14T12:00:00Z', '2026-06-14T12:00:00Z'),
(yufan_id, 'embed',          '/ɪmˈbed/',       'verb',        'to fix or implant something firmly inside a surrounding substance',      '嵌入；植入',       'science', '2026-06-14T12:00:00Z', '2026-06-14T12:00:00Z'),
(yufan_id, 'existence',      '/ɪɡˈzɪstəns/',   'noun',        'the fact or state of living or having objective reality',               '存在；生存',       'science', '2026-06-14T12:00:00Z', '2026-06-14T12:00:00Z'),
(yufan_id, 'malleable',      '/ˈmæliəbəl/',    'adjective',   'able to be hammered or pressed into shape without breaking; easy to influence','可塑的；延展性的','science', '2026-06-14T12:00:00Z', '2026-06-14T12:00:00Z'),
(yufan_id, 'solubility',     '/ˌsɒljʊˈbɪlɪti/','noun',        'the ability of a substance to dissolve in a liquid',                    '溶解度',           'science', '2026-06-14T12:00:00Z', '2026-06-14T12:00:00Z'),
(yufan_id, 'reactivity',     '/ˌriːækˈtɪvɪti/','noun',        'the tendency of a substance to undergo chemical reactions',             '反应性；活性',     'science', '2026-06-14T12:00:00Z', '2026-06-14T12:00:00Z'),
(yufan_id, 'log',            '/lɒɡ/',          'noun',        'a piece of a cut tree trunk or branch',                                 '原木；圆木',       'science', '2026-06-14T12:00:00Z', '2026-06-14T12:00:00Z'),
(yufan_id, 'rust',           '/rʌst/',         'noun',        'a reddish-brown coating that forms on iron or steel when exposed to moisture','铁锈',         'science', '2026-06-14T12:00:00Z', '2026-06-14T12:00:00Z'),
(yufan_id, 'odor',           '/ˈəʊdər/',       'noun',        'a smell, especially one that is strong or unpleasant',                  '气味；异味',       'science', '2026-06-14T12:00:00Z', '2026-06-14T12:00:00Z'),

-- ── June 12, 2026 — science (lab equipment) ─────────────────────────────────
(yufan_id, 'mold',           '/məʊld/',        'noun',        'a hollow container used to shape liquid or soft material; also a type of fungus','模具；霉菌','science', '2026-06-12T12:00:00Z', '2026-06-12T12:00:00Z'),
(yufan_id, 'poisonous',      '/ˈpɔɪzənəs/',    'adjective',   'containing or producing poison; causing illness or death if swallowed', '有毒的',           'science', '2026-06-12T12:00:00Z', '2026-06-12T12:00:00Z'),
(yufan_id, 'radioactive',    '/ˌreɪdiəʊˈæktɪv/','adjective',  'emitting harmful radiation as a result of nuclear decay',               '放射性的',         'science', '2026-06-12T12:00:00Z', '2026-06-12T12:00:00Z'),
(yufan_id, 'flammable',      '/ˈflæməbəl/',    'adjective',   'easily set on fire',                                                    '易燃的',           'science', '2026-06-12T12:00:00Z', '2026-06-12T12:00:00Z'),
(yufan_id, 'corrosive',      '/kəˈrəʊsɪv/',    'adjective',   'able to damage or destroy materials through chemical action',           '腐蚀性的',         'science', '2026-06-12T12:00:00Z', '2026-06-12T12:00:00Z'),
(yufan_id, 'tong',           '/tɒŋ/',          'noun',        'a gripping tool with two arms, used in labs to handle hot objects',     '钳子；夹钳',       'science', '2026-06-12T12:00:00Z', '2026-06-12T12:00:00Z'),
(yufan_id, 'waft',           '/wɒft/',         'verb',        'to be carried gently through the air',                                  '飘散；漂移',       'science', '2026-06-12T12:00:00Z', '2026-06-12T12:00:00Z'),
(yufan_id, 'specimen',       '/ˈspesɪmən/',    'noun',        'a sample of something taken for scientific examination or analysis',     '样本；标本',       'science', '2026-06-12T12:00:00Z', '2026-06-12T12:00:00Z'),
(yufan_id, 'stovetop',       '/ˈstəʊvtɒp/',    'noun',        'the flat cooking surface on top of a stove',                            '炉灶台面；炉头',   'science', '2026-06-12T12:00:00Z', '2026-06-12T12:00:00Z'),
(yufan_id, 'flask',          '/flɑːsk/',       'noun',        'a glass bottle with a narrow neck used in a laboratory for experiments', '烧瓶',             'science', '2026-06-12T12:00:00Z', '2026-06-12T12:00:00Z'),
(yufan_id, 'rod',            '/rɒd/',          'noun',        'a thin, straight bar or stick, used in labs for stirring liquids',      '棒；杆',           'science', '2026-06-12T12:00:00Z', '2026-06-12T12:00:00Z'),
(yufan_id, 'stirring',       '/ˈstɜːrɪŋ/',     'adjective',   'causing strong feelings of excitement or emotion',                      '激动人心的；搅拌的','science', '2026-06-12T12:00:00Z', '2026-06-12T12:00:00Z'),
(yufan_id, 'funnel',         '/ˈfʌnəl/',       'noun',        'a tube wide at the top and narrow at the bottom, used to pour liquids into a small opening','漏斗','science', '2026-06-12T12:00:00Z', '2026-06-12T12:00:00Z'),
(yufan_id, 'microscope',     '/ˈmaɪkrəskəʊp/', 'noun',        'an instrument that magnifies very small objects for scientific observation','显微镜',        'science', '2026-06-12T12:00:00Z', '2026-06-12T12:00:00Z'),
(yufan_id, 'slide',          '/slaɪd/',        'noun',        'a flat piece of glass on which a specimen is placed for examination under a microscope','载玻片','science', '2026-06-12T12:00:00Z', '2026-06-12T12:00:00Z'),

-- ── June 11, 2026 — science (lab safety) ────────────────────────────────────
(yufan_id, 'cautious',       '/ˈkɔːʃəs/',      'adjective',   'careful to avoid potential problems or danger',                         '谨慎的；小心的',   'science', '2026-06-11T12:00:00Z', '2026-06-11T12:00:00Z'),
(yufan_id, 'apron',          '/ˈeɪprən/',      'noun',        'a protective garment worn over the front of clothing, especially in a lab','围裙；实验服',   'science', '2026-06-11T12:00:00Z', '2026-06-11T12:00:00Z'),
(yufan_id, 'splash',         '/splæʃ/',        'verb',        'to cause liquid to scatter in drops in different directions',            '溅；泼',           'science', '2026-06-11T12:00:00Z', '2026-06-11T12:00:00Z'),
(yufan_id, 'toxic',          '/ˈtɒksɪk/',      'adjective',   'poisonous and able to cause serious illness or death',                  '有毒的；毒性的',   'science', '2026-06-11T12:00:00Z', '2026-06-11T12:00:00Z'),
(yufan_id, 'rinse',          '/rɪns/',         'verb',        'to wash something lightly with clean water to remove soap or dirt',     '冲洗；漂洗',       'science', '2026-06-11T12:00:00Z', '2026-06-11T12:00:00Z'),
(yufan_id, 'fountain',       '/ˈfaʊntɪn/',     'noun',        'a structure that sends a jet of water into the air; a drinking fountain', '喷泉；饮水台',    'science', '2026-06-11T12:00:00Z', '2026-06-11T12:00:00Z'),
(yufan_id, 'thermal',        '/ˈθɜːməl/',      'adjective',   'relating to heat or temperature',                                       '热的；热力的',     'science', '2026-06-11T12:00:00Z', '2026-06-11T12:00:00Z'),
(yufan_id, 'mitt',           '/mɪt/',          'noun',        'a large, thick glove used to protect the hand from heat or cold',       '隔热手套',         'science', '2026-06-11T12:00:00Z', '2026-06-11T12:00:00Z'),
(yufan_id, 'contaminate',    '/kənˈtæmɪneɪt/', 'verb',        'to make something impure or harmful by introducing a pollutant',        '污染；弄脏',       'science', '2026-06-11T12:00:00Z', '2026-06-11T12:00:00Z'),
(yufan_id, 'precaution',     '/prɪˈkɔːʃən/',   'noun',        'an action taken in advance to prevent danger or reduce risk',           '预防措施',         'science', '2026-06-11T12:00:00Z', '2026-06-11T12:00:00Z'),
(yufan_id, 'mop',            '/mɒp/',          'noun',        'a tool with a long handle and absorbent head used to clean floors',     '拖把',             'science', '2026-06-11T12:00:00Z', '2026-06-11T12:00:00Z'),
(yufan_id, 'disposal',       '/dɪˈspəʊzəl/',   'noun',        'the process of getting rid of waste or hazardous materials safely',     '处置；废物处理',   'science', '2026-06-11T12:00:00Z', '2026-06-11T12:00:00Z'),
(yufan_id, 'supervisor',     '/ˈsuːpərvaɪzər/','noun',        'a person who oversees and directs the work or safety of others',        '监督员；主管',     'science', '2026-06-11T12:00:00Z', '2026-06-11T12:00:00Z'),
(yufan_id, 'hazardous',      '/ˈhæzədəs/',     'adjective',   'dangerous or risky, especially to health or the environment',          '危险的；有害的',   'science', '2026-06-11T12:00:00Z', '2026-06-11T12:00:00Z'),
(yufan_id, 'major',          '/ˈmeɪdʒər/',     'adjective',   'important, serious, or significant in size or effect',                  '重大的；主要的',   'science', '2026-06-11T12:00:00Z', '2026-06-11T12:00:00Z');

-- ============================================================================
-- Step 2: Create review_schedule for all imported words (all due today)
-- ============================================================================

INSERT INTO review_schedule (word_id, user_id, next_review_date, review_level, interval_days, created_at, updated_at)
SELECT
    w.id,
    yufan_id,
    CURRENT_DATE,
    0,
    1,
    NOW(),
    NOW()
FROM words w
WHERE w.user_id = yufan_id
  AND NOT EXISTS (
      SELECT 1 FROM review_schedule rs WHERE rs.word_id = w.id
  );

RAISE NOTICE 'Import complete: 119 words inserted with IPA, English definitions, and Chinese translations.';

END $$;
