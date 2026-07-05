// multilingual-voice-bot.js - Multilingual Voice Closing System
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// LANGUAGE CONFIGURATION
// ============================================
const LANGUAGES = {
    'en': {
        name: 'English',
        code: 'en-US',
        voice: 'en-US-Neural2-F',
        scripts: {
            intro: [
                "Hello, this is Sovereign AI Assistant. I'm calling because you expressed interest in our AI automation platform.",
                "Hi, I'm Sovereign AI Assistant. I noticed you were interested in how AI can help your business."
            ],
            qualification: [
                "Do you have a moment to chat about how we can help your business grow?",
                "Is now a good time to discuss how AI can transform your operations?"
            ],
            valuePitch: [
                "Based on what you've shared, we can help you save 20+ hours per week and increase revenue by 40%.",
                "Other companies in your industry have seen ROI within 30 days using our platform."
            ],
            objectionHandling: {
                price: [
                    "I understand the price concern. Many clients generated 3x ROI in 90 days.",
                    "The cost is offset by the 20+ hours per week you'll save."
                ],
                timing: [
                    "We can start with a 30-day trial so you can see results before committing.",
                    "The sooner you start, the sooner you'll see the benefits."
                ]
            },
            closing: [
                "Based on our conversation, I'll send you a proposal within 24 hours.",
                "When would be a good time to follow up and review the proposal together?"
            ],
            finalClose: [
                "Great! I'll send the proposal to your email. Once you sign, we can start saving you time immediately.",
                "Perfect! You'll receive the contract within 24 hours. Once signed, our team will set everything up."
            ]
        }
    },
    'es': {
        name: 'Spanish',
        code: 'es-ES',
        voice: 'es-ES-Neural2-F',
        scripts: {
            intro: [
                "Hola, soy el Asistente AI de Sovereign Empire. Llamo porque mostró interés en nuestra plataforma de automatización con IA.",
                "Hola, soy el Asistente AI de Sovereign Empire. Noté que estaba interesado en cómo la IA puede ayudar a su negocio."
            ],
            qualification: [
                "¿Tiene un momento para hablar sobre cómo podemos ayudar a su negocio a crecer?",
                "¿Es ahora un buen momento para discutir cómo la IA puede transformar sus operaciones?"
            ],
            valuePitch: [
                "Basado en lo que compartió, podemos ayudarle a ahorrar 20+ horas por semana y aumentar los ingresos en un 40%.",
                "Otras empresas en su industria han visto ROI en 30 días usando nuestra plataforma."
            ],
            objectionHandling: {
                price: [
                    "Entiendo la preocupación por el precio. Muchos clientes generaron 3x ROI en 90 días.",
                    "El costo se compensa con las 20+ horas por semana que ahorrará."
                ],
                timing: [
                    "Podemos comenzar con una prueba de 30 días para que vea los resultados antes de comprometerse.",
                    "Cuanto antes comience, antes verá los beneficios."
                ]
            },
            closing: [
                "Basado en nuestra conversación, le enviaré una propuesta en 24 horas.",
                "¿Cuándo sería un buen momento para hacer seguimiento y revisar la propuesta juntos?"
            ],
            finalClose: [
                "¡Excelente! Le enviaré la propuesta a su correo electrónico. Una vez que firme, podemos comenzar a ahorrarle tiempo de inmediato.",
                "¡Perfecto! Recibirá el contrato en 24 horas. Una vez firmado, nuestro equipo configurará todo."
            ]
        }
    },
    'fr': {
        name: 'French',
        code: 'fr-FR',
        voice: 'fr-FR-Neural2-F',
        scripts: {
            intro: [
                "Bonjour, je suis l'assistant IA de Sovereign Empire. Je vous appelle car vous avez manifesté votre intérêt pour notre plateforme d'automatisation IA.",
                "Bonjour, je suis l'assistant IA de Sovereign Empire. J'ai remarqué que vous étiez intéressé par la façon dont l'IA peut aider votre entreprise."
            ],
            qualification: [
                "Avez-vous un moment pour discuter de la façon dont nous pouvons aider votre entreprise à se développer?",
                "Est-ce le bon moment pour discuter de la façon dont l'IA peut transformer vos opérations?"
            ],
            valuePitch: [
                "D'après ce que vous avez partagé, nous pouvons vous aider à économiser 20+ heures par semaine et à augmenter vos revenus de 40%.",
                "D'autres entreprises de votre secteur ont vu un ROI en 30 jours en utilisant notre plateforme."
            ],
            objectionHandling: {
                price: [
                    "Je comprends le souci du prix. De nombreux clients ont généré 3x ROI en 90 jours.",
                    "Le coût est compensé par les 20+ heures par semaine que vous économiserez."
                ],
                timing: [
                    "Nous pouvons commencer par un essai de 30 jours pour que vous voyez les résultats avant de vous engager.",
                    "Plus tôt vous commencez, plus tôt vous verrez les avantages."
                ]
            },
            closing: [
                "Sur la base de notre conversation, je vous enverrai une proposition dans les 24 heures.",
                "Quand serait-il bon de faire un suivi et d'examiner la proposition ensemble?"
            ],
            finalClose: [
                "Super! Je vous enverrai la proposition par email. Une fois que vous aurez signé, nous pourrons commencer à vous faire gagner du temps immédiatement.",
                "Parfait! Vous recevrez le contrat dans les 24 heures. Une fois signé, notre équipe mettra tout en place."
            ]
        }
    },
    'de': {
        name: 'German',
        code: 'de-DE',
        voice: 'de-DE-Neural2-F',
        scripts: {
            intro: [
                "Hallo, ich bin der KI-Assistent von Sovereign Empire. Ich rufe an, weil Sie Interesse an unserer KI-Automatisierungsplattform bekundet haben.",
                "Hallo, ich bin der KI-Assistent von Sovereign Empire. Ich habe bemerkt, dass Sie interessiert waren, wie KI Ihrem Unternehmen helfen kann."
            ],
            qualification: [
                "Haben Sie einen Moment Zeit, um zu besprechen, wie wir Ihrem Unternehmen beim Wachstum helfen können?",
                "Ist jetzt ein guter Zeitpunkt, um zu besprechen, wie KI Ihre Abläufe transformieren kann?"
            ],
            valuePitch: [
                "Basierend auf dem, was Sie geteilt haben, können wir Ihnen helfen, 20+ Stunden pro Woche zu sparen und den Umsatz um 40% zu steigern.",
                "Andere Unternehmen in Ihrer Branche haben innerhalb von 30 Tagen ROI mit unserer Plattform erzielt."
            ],
            objectionHandling: {
                price: [
                    "Ich verstehe die Preisbedenken. Viele Kunden erzielten in 90 Tagen 3x ROI.",
                    "Die Kosten werden durch die 20+ Stunden pro Woche ausgeglichen, die Sie sparen werden."
                ],
                timing: [
                    "Wir können mit einer 30-tägigen Testphase beginnen, damit Sie die Ergebnisse sehen können, bevor Sie sich festlegen.",
                    "Je früher Sie beginnen, desto früher werden Sie die Vorteile sehen."
                ]
            },
            closing: [
                "Basierend auf unserem Gespräch werde ich Ihnen innerhalb von 24 Stunden ein Angebot senden.",
                "Wann wäre ein guter Zeitpunkt für ein Follow-up, um das Angebot gemeinsam zu prüfen?"
            ],
            finalClose: [
                "Großartig! Ich sende Ihnen das Angebot per E-Mail. Sobald Sie unterschrieben haben, können wir sofort anfangen, Ihnen Zeit zu sparen.",
                "Perfekt! Sie erhalten den Vertrag innerhalb von 24 Stunden. Sobald er unterschrieben ist, wird unser Team alles einrichten."
            ]
        }
    },
    'zh': {
        name: 'Chinese',
        code: 'zh-CN',
        voice: 'zh-CN-Neural2-F',
        scripts: {
            intro: [
                "您好，我是 Sovereign Empire 的 AI 助理。我打电话是因为您对我们的 AI 自动化平台表示了兴趣。",
                "您好，我是 Sovereign Empire 的 AI 助理。我注意到您对 AI 如何帮助您的业务感兴趣。"
            ],
            qualification: [
                "您有时间聊聊我们如何帮助您的业务增长吗？",
                "现在是讨论 AI 如何改变您的运营的好时机吗？"
            ],
            valuePitch: [
                "根据您分享的内容，我们可以帮助您每周节省 20 多个小时，并将收入提高 40%。",
                "您所在行业的其他公司使用我们的平台在 30 天内就获得了回报。"
            ],
            objectionHandling: {
                price: [
                    "我理解价格方面的顾虑。许多客户在 90 天内获得了 3 倍的投资回报。",
                    "成本会被您每周节省的 20 多个小时所抵消。"
                ],
                timing: [
                    "我们可以从 30 天的试用期开始，让您在承诺之前看到结果。",
                    "您越早开始，就越早看到好处。"
                ]
            },
            closing: [
                "根据我们的讨论，我将在 24 小时内向您发送提案。",
                "什么时候是跟进并一起审查提案的好时机？"
            ],
            finalClose: [
                "太好了！我会把提案发送到您的邮箱。一旦您签署，我们就可以立即开始为您节省时间。",
                "完美！您将在 24 小时内收到合同。一旦签署，我们的团队将为您设置一切。"
            ]
        }
    },
    'ja': {
        name: 'Japanese',
        code: 'ja-JP',
        voice: 'ja-JP-Neural2-F',
        scripts: {
            intro: [
                "こんにちは、Sovereign EmpireのAIアシスタントです。AI自動化プラットフォームにご興味をお持ちいただき、お電話いたしました。",
                "こんにちは、Sovereign EmpireのAIアシスタントです。AIがどのようにビジネスに役立つかにご興味をお持ちだと伺いました。"
            ],
            qualification: [
                "ビジネスの成長をどのように支援できるかについてお話しする時間はありますか？",
                "AIがどのように業務を変革できるかについて話し合うのに、今は良いタイミングですか？"
            ],
            valuePitch: [
                "ご共有いただいた内容に基づき、週20時間以上の節約と収益40%増加をお手伝いできます。",
                "御社の業界の他の企業は、当社のプラットフォームを使用して30日以内にROIを達成しています。"
            ],
            objectionHandling: {
                price: [
                    "価格のご懸念は理解しております。多くのお客様が90日間で3倍のROIを達成されています。",
                    "コストは、週20時間以上の節約によって相殺されます。"
                ],
                timing: [
                    "30日間のトライアルから始めて、コミットする前に結果をご確認いただけます。",
                    "早く始めれば始めるほど、早くメリットを実感いただけます。"
                ]
            },
            closing: [
                "本日の会話に基づき、24時間以内に提案書をお送りいたします。",
                "提案書を一緒に確認するフォローアップに適したタイミングはいつですか？"
            ],
            finalClose: [
                "素晴らしい！提案書をメールでお送りします。署名いただきましたら、すぐに時間節約を開始できます。",
                "完璧です！24時間以内に契約書をお受け取りいただけます。署名後、当社チームがすべてをセットアップいたします。"
            ]
        }
    },
    'ar': {
        name: 'Arabic',
        code: 'ar-SA',
        voice: 'ar-SA-Neural2-F',
        scripts: {
            intro: [
                "مرحباً، أنا مساعد الذكاء الاصطناعي من Sovereign Empire. أتصل بك لأنك أبديت اهتماماً بمنصتنا لأتمتة الذكاء الاصطناعي.",
                "مرحباً، أنا مساعد الذكاء الاصطناعي من Sovereign Empire. لاحظت أنك كنت مهتماً بكيفية مساعدة الذكاء الاصطناعي لعملك."
            ],
            qualification: [
                "هل لديك لحظة للحديث عن كيف يمكننا مساعدة عملك على النمو؟",
                "هل الآن وقت مناسب لمناقشة كيف يمكن للذكاء الاصطناعي تحويل عملياتك؟"
            ],
            valuePitch: [
                "بناءً على ما شاركته، يمكننا مساعدتك في توفير 20+ ساعة أسبوعياً وزيادة الإيرادات بنسبة 40%.",
                "شركات أخرى في مجال عملك حققت عائداً على الاستثمار في غضون 30 يوماً باستخدام منصتنا."
            ],
            objectionHandling: {
                price: [
                    "أتفهم القلق بشأن السعر. حقق العديد من العملاء عائد استثمار 3x في 90 يوماً.",
                    "يتم تعويض التكلفة من خلال الـ 20+ ساعة أسبوعياً التي ستوفرها."
                ],
                timing: [
                    "يمكننا البدء بتجربة 30 يوماً حتى ترى النتائج قبل الالتزام.",
                    "كلما بدأت مبكراً، كلما رأيت الفوائد مبكراً."
                ]
            },
            closing: [
                "بناءً على محادثتنا، سأرسل لك عرضاً خلال 24 ساعة.",
                "متى يكون وقت مناسب للمتابعة ومراجعة العرض معاً؟"
            ],
            finalClose: [
                "رائع! سأرسل العرض إلى بريدك الإلكتروني. بمجرد التوقيع، يمكننا البدء في توفير الوقت لك فوراً.",
                "ممتاز! ستتلقى العقد خلال 24 ساعة. بمجرد التوقيع، سيقوم فريقنا بإعداد كل شيء."
            ]
        }
    }
};

// ============================================
// MULTILINGUAL VOICE BOT CLASS
// ============================================
class MultilingualVoiceBot {
    constructor() {
        this.leads = [];
        this.deals = [];
        this.revenue = 0;
        this.stateFile = './multilingual-voice-state.json';
        this.supportedLanguages = Object.keys(LANGUAGES);
        this.loadState();
    }

    loadState() {
        try {
            if (fs.existsSync(this.stateFile)) {
                const data = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
                this.leads = data.leads || [];
                this.deals = data.deals || [];
                this.revenue = data.revenue || 0;
                console.log(`📂 Loaded multilingual state: ${this.leads.length} leads, $${this.revenue} revenue`);
            }
        } catch (e) {
            console.log('📂 Starting fresh multilingual voice state');
        }
    }

    saveState() {
        const state = {
            leads: this.leads,
            deals: this.deals,
            revenue: this.revenue,
            timestamp: new Date().toISOString()
        };
        fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2));
    }

    // ============================================
    // LEAD DISCOVERY WITH LANGUAGE DETECTION
    // ============================================
    discoverLeads() {
        console.log('🔍 Discovering multilingual leads...');
        
        const sampleLeads = [
            { id: 'lead_1', name: 'Sarah Johnson', company: 'TechFlow Solutions', phone: '+1-555-0101', email: 'sarah@techflow.com', industry: 'SaaS', language: 'en' },
            { id: 'lead_2', name: 'Carlos Rodriguez', company: 'DataSphere Inc', phone: '+1-555-0102', email: 'carlos@datasphere.com', industry: 'Technology', language: 'es' },
            { id: 'lead_3', name: 'Marie Dubois', company: 'CloudPioneer', phone: '+1-555-0103', email: 'marie@cloudpioneer.com', industry: 'Cloud Services', language: 'fr' },
            { id: 'lead_4', name: 'Hans Schmidt', company: 'AI Innovations', phone: '+1-555-0104', email: 'hans@aiinnovations.com', industry: 'AI', language: 'de' },
            { id: 'lead_5', name: 'Wei Zhang', company: 'Digital Transform', phone: '+1-555-0105', email: 'wei@digitaltransform.com', industry: 'Digital Marketing', language: 'zh' },
            { id: 'lead_6', name: 'Yuki Tanaka', company: 'Nexus Systems', phone: '+1-555-0106', email: 'yuki@nexus.com', industry: 'Software', language: 'ja' },
            { id: 'lead_7', name: 'Fatima Al-Hassan', company: 'BrightCore', phone: '+1-555-0107', email: 'fatima@brightcore.com', industry: 'FinTech', language: 'ar' },
            { id: 'lead_8', name: 'David Patel', company: 'Quantum AI', phone: '+1-555-0108', email: 'david@quantum.ai', industry: 'AI/ML', language: 'en' },
            { id: 'lead_9', name: 'Maria Garcia', company: 'EcoSphere', phone: '+1-555-0109', email: 'maria@ecosphere.com', industry: 'Sustainability', language: 'es' },
            { id: 'lead_10', name: 'Thomas Brown', company: 'Nova Solutions', phone: '+1-555-0110', email: 'thomas@novasolutions.com', industry: 'Consulting', language: 'en' }
        ];
        
        const newLeads = sampleLeads.filter(lead => 
            !this.leads.some(l => l.id === lead.id)
        );
        
        if (newLeads.length > 0) {
            this.leads.push(...newLeads);
            this.saveState();
            console.log(`✅ Added ${newLeads.length} multilingual leads`);
        }
        
        return this.leads;
    }

    // ============================================
    // GET LANGUAGE SCRIPTS
    // ============================================
    getLanguageScripts(languageCode) {
        const lang = LANGUAGES[languageCode] || LANGUAGES['en'];
        return lang.scripts;
    }

    getLanguageName(languageCode) {
        return LANGUAGES[languageCode]?.name || 'English';
    }

    // ============================================
    // GENERATE MULTILINGUAL SCRIPT
    // ============================================
    generateScript(lead, stage = 'intro') {
        const languageCode = lead.language || 'en';
        const scripts = this.getLanguageScripts(languageCode);
        const langName = this.getLanguageName(languageCode);
        
        let script = '';
        
        switch(stage) {
            case 'intro':
                const introOptions = scripts.intro;
                script = introOptions[Math.floor(Math.random() * introOptions.length)];
                script += ' ' + scripts.qualification[Math.floor(Math.random() * scripts.qualification.length)];
                break;
                
            case 'discovery':
                script = scripts.qualification[Math.floor(Math.random() * scripts.qualification.length)];
                break;
                
            case 'value':
                script = scripts.valuePitch[Math.floor(Math.random() * scripts.valuePitch.length)];
                break;
                
            case 'objection':
                const objections = scripts.objectionHandling;
                const objectionTypes = Object.keys(objections);
                const type = objectionTypes[Math.floor(Math.random() * objectionTypes.length)];
                script = objections[type][Math.floor(Math.random() * objections[type].length)];
                break;
                
            case 'closing':
                script = scripts.closing[Math.floor(Math.random() * scripts.closing.length)];
                break;
                
            case 'final_close':
                script = scripts.finalClose[Math.floor(Math.random() * scripts.finalClose.length)];
                break;
                
            default:
                script = "I'm calling to follow up on your interest in our AI platform. Do you have a moment?";
        }
        
        // Add language tag for logging
        console.log(`🌍 [${langName}] Script generated`);
        return script;
    }

    // ============================================
    // SIMULATE LEAD RESPONSE (Multilingual)
    // ============================================
    simulateLeadResponse(stage, lead) {
        const languageCode = lead.language || 'en';
        
        const responses = {
            'en': {
                intro: ["Hi, yes I have a moment.", "Hello, thanks for calling.", "Yes, I'm interested in learning more."],
                discovery: ["We're spending too much time on manual tasks.", "Our team is overwhelmed with repetitive work.", "We're looking to scale but can't afford more headcount."],
                value: ["That sounds very interesting.", "I'd like to hear more about that.", "What kind of results have other companies seen?"],
                objection: ["I'm concerned about the cost.", "We've tried AI before and it didn't work.", "I need to check with my team first."],
                closing: ["I think this could really work for us.", "I'm interested. What are the next steps?", "That sounds promising. Send me the proposal."]
            },
            'es': {
                intro: ["Hola, sí tengo un momento.", "Hola, gracias por llamar.", "Sí, me interesa saber más."],
                discovery: ["Pasamos demasiado tiempo en tareas manuales.", "Nuestro equipo está abrumado con trabajo repetitivo.", "Buscamos escalar pero no podemos contratar más personal."],
                value: ["Suena muy interesante.", "Me gustaría saber más sobre eso.", "¿Qué tipo de resultados han visto otras empresas?"],
                objection: ["Me preocupa el costo.", "Ya hemos probado IA antes y no funcionó.", "Necesito consultarlo con mi equipo primero."],
                closing: ["Creo que esto realmente podría funcionar para nosotros.", "Estoy interesado. ¿Cuáles son los siguientes pasos?", "Suena prometedor. Envíeme la propuesta."]
            },
            'fr': {
                intro: ["Bonjour, oui j'ai un moment.", "Bonjour, merci d'appeler.", "Oui, je suis intéressé à en savoir plus."],
                discovery: ["Nous passons trop de temps sur des tâches manuelles.", "Notre équipe est submergée par le travail répétitif.", "Nous cherchons à évoluer mais ne pouvons pas embaucher plus de personnel."],
                value: ["C'est très intéressant.", "J'aimerais en savoir plus à ce sujet.", "Quels résultats d'autres entreprises ont-elles obtenus?"],
                objection: ["Je m'inquiète du coût.", "Nous avons déjà essayé l'IA et ça n'a pas fonctionné.", "Je dois vérifier avec mon équipe d'abord."],
                closing: ["Je pense que cela pourrait vraiment fonctionner pour nous.", "Je suis intéressé. Quelles sont les prochaines étapes?", "Cela semble prometteur. Envoyez-moi la proposition."]
            },
            'de': {
                intro: ["Hallo, ja ich habe einen Moment.", "Hallo, danke für den Anruf.", "Ja, ich bin interessiert, mehr zu erfahren."],
                discovery: ["Wir verbringen zu viel Zeit mit manuellen Aufgaben.", "Unser Team ist mit repetitiver Arbeit überfordert.", "Wir möchten wachsen, können aber kein weiteres Personal einstellen."],
                value: ["Das klingt sehr interessant.", "Ich würde gerne mehr darüber erfahren.", "Welche Ergebnisse haben andere Unternehmen erzielt?"],
                objection: ["Ich mache mir Sorgen wegen der Kosten.", "Wir haben KI schon einmal ausprobiert und es hat nicht funktioniert.", "Ich muss zuerst mit meinem Team sprechen."],
                closing: ["Ich denke, das könnte wirklich für uns funktionieren.", "Ich bin interessiert. Was sind die nächsten Schritte?", "Das klingt vielversprechend. Senden Sie mir das Angebot."]
            }
        };
        
        const langResponses = responses[languageCode] || responses['en'];
        const stageResponses = langResponses[stage] || langResponses.intro;
        return stageResponses[Math.floor(Math.random() * stageResponses.length)];
    }

    // ============================================
    // DETERMINE OUTCOME
    // ============================================
    determineOutcome(interestLevel, objections) {
        let adjustedInterest = interestLevel - (objections * 15);
        adjustedInterest = Math.max(0, Math.min(100, adjustedInterest));
        adjustedInterest += Math.floor(Math.random() * 10) - 5;
        adjustedInterest = Math.max(0, Math.min(100, adjustedInterest));
        
        const statuses = [
            { threshold: 75, status: 'closed', successRate: 0.35 },
            { threshold: 55, status: 'interested', successRate: 0.25 },
            { threshold: 35, status: 'maybe', successRate: 0.20 },
            { threshold: 15, status: 'not_interested', successRate: 0.10 },
            { threshold: 0, status: 'rejected', successRate: 0.05 }
        ];
        
        for (const status of statuses) {
            if (adjustedInterest >= status.threshold) {
                const success = Math.random() < status.successRate;
                return {
                    status: success && status.status === 'closed' ? 'closed' : status.status,
                    interestLevel: adjustedInterest,
                    success: success
                };
            }
        }
        
        return { status: 'rejected', interestLevel: adjustedInterest, success: false };
    }

    // ============================================
    // MAKE MULTILINGUAL CALL
    // ============================================
    async makeCall(lead) {
        const langName = this.getLanguageName(lead.language || 'en');
        console.log(`\n📞 CALLING: ${lead.name} (${lead.company})`);
        console.log(`🌍 Language: ${langName}`);
        console.log(`📱 Phone: ${lead.phone}`);
        
        const stages = ['intro', 'discovery', 'value', 'objection', 'closing'];
        let callLog = [];
        let interestLevel = 0;
        let objections = 0;
        
        console.log('📝 CALL SCRIPT:');
        console.log('='.repeat(40));
        
        for (const stage of stages) {
            const script = this.generateScript(lead, stage);
            console.log(`[${stage.toUpperCase()}] ${script}`);
            callLog.push({ stage, script, language: lead.language });
            
            const response = this.simulateLeadResponse(stage, lead);
            console.log(`[LEAD] ${response}`);
            callLog.push({ stage: 'response', response });
            
            // Track interest
            if (response.includes('interested') || response.includes('yes') || response.includes('sounds') || 
                response.includes('interesado') || response.includes('intéressé') || response.includes('interessiert') ||
                response.includes('感兴趣') || response.includes('興味')) {
                interestLevel += 25;
            }
            if (response.includes('price') || response.includes('cost') || response.includes('expensive') ||
                response.includes('precio') || response.includes('coût') || response.includes('Preis') ||
                response.includes('价格') || response.includes('価格')) {
                objections++;
                interestLevel -= 10;
            }
        }
        
        const finalScript = this.generateScript(lead, 'final_close');
        console.log(`[FINAL] ${finalScript}`);
        callLog.push({ stage: 'final_close', script: finalScript, language: lead.language });
        
        const outcome = this.determineOutcome(interestLevel, objections);
        
        console.log('='.repeat(40));
        console.log(`📊 CALL OUTCOME: ${outcome.status}`);
        console.log(`💬 Interest Level: ${interestLevel}%`);
        console.log(`🛡️ Objections: ${objections}`);
        console.log(`🌍 Language: ${langName}`);
        
        lead.lastCall = new Date().toISOString();
        lead.status = outcome.status;
        lead.interestLevel = interestLevel;
        lead.callLog = callLog;
        lead.languageUsed = lead.language || 'en';
        
        if (outcome.status === 'closed') {
            const dealValue = 5000 + Math.floor(Math.random() * 15000);
            const deal = {
                id: `deal_${Date.now()}`,
                lead: lead,
                value: dealValue,
                language: lead.language || 'en',
                closedDate: new Date().toISOString(),
                revenue: dealValue
            };
            this.deals.push(deal);
            this.revenue += dealValue;
            console.log(`💰 DEAL CLOSED: ${lead.name} - $${dealValue} (${langName})`);
        }
        
        this.saveState();
        return { lead, outcome, callLog };
    }

    // ============================================
    // RUN CAMPAIGN
    // ============================================
    async runCampaign() {
        console.log('\n' + '='.repeat(60));
        console.log('🌍 MULTILINGUAL VOICE CLOSING SYSTEM');
        console.log('='.repeat(60));
        console.log(`📅 ${new Date().toLocaleString()}`);
        console.log(`📊 ${this.leads.length} leads in system`);
        console.log(`💰 ${this.deals.length} deals closed`);
        console.log(`💵 Revenue: $${this.revenue}`);
        console.log(`🌍 Supported Languages: ${this.supportedLanguages.length}`);
        console.log('');
        
        this.discoverLeads();
        
        const leadsToCall = this.leads.filter(lead => 
            !lead.lastCall
        ).slice(0, 5);
        
        console.log(`📞 ${leadsToCall.length} leads ready for multilingual calls`);
        console.log(`🌍 Languages: ${[...new Set(leadsToCall.map(l => this.getLanguageName(l.language || 'en')))].join(', ')}`);
        
        for (const lead of leadsToCall) {
            await this.makeCall(lead);
            await new Promise(r => setTimeout(r, 2000));
        }
        
        this.generateReport();
    }

    generateReport() {
        const totalLeads = this.leads.length;
        const calledLeads = this.leads.filter(l => l.lastCall).length;
        const interestedLeads = this.leads.filter(l => l.status === 'interested' || l.status === 'maybe').length;
        const closedDeals = this.deals.length;
        const totalRevenue = this.revenue;
        
        // Language breakdown
        const langBreakdown = {};
        for (const lead of this.leads) {
            const lang = lead.language || 'en';
            const name = this.getLanguageName(lang);
            if (!langBreakdown[name]) langBreakdown[name] = 0;
            langBreakdown[name]++;
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('🌍 MULTILINGUAL VOICE BOT REPORT');
        console.log('='.repeat(60));
        console.log(`📋 Total Leads: ${totalLeads}`);
        console.log(`📞 Called: ${calledLeads}`);
        console.log(`🎯 Interested: ${interestedLeads}`);
        console.log(`💰 Deals Closed: ${closedDeals}`);
        console.log(`💵 Revenue: $${totalRevenue}`);
        console.log('');
        console.log('🌍 Language Breakdown:');
        for (const [lang, count] of Object.entries(langBreakdown)) {
            console.log(`   ${lang}: ${count} leads`);
        }
        console.log('='.repeat(60));
        
        this.saveState();
    }
}

// ============================================
// START
// ============================================
const voiceBot = new MultilingualVoiceBot();

// Run immediately
await voiceBot.runCampaign();

// Run every 2 hours
setInterval(async () => {
    await voiceBot.runCampaign();
}, 2 * 60 * 60 * 1000);

console.log('\n⏰ Multilingual voice bot running every 2 hours');
console.log(`🌍 Supported Languages: ${voiceBot.supportedLanguages.length}`);
console.log('📞 Autonomous multilingual closing system active');