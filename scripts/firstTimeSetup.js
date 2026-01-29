export class FirstTimeSetup {
    constructor(editor) {
        this.editor = editor;
        this.currentStep = 0;
        this.steps = [
            {
                title: 'Welcome to DreamSync Studio 4!',
                content: 'Professional chart editor with AI auto mapping. Designed for DreamSyncX.',
                icon: '👋',
                features: [
                    { icon: '🤖', text: 'AI Auto-Mapping' },
                    { icon: '🎵', text: 'Visual Timeline' },
                    { icon: '⚡', text: 'Real-time Preview' }
                ]
            },
            {
                title: 'License Agreement',
                content: 'Please read and accept the End User License Agreement to continue.',
                icon: '📄',
                isEULA: true
            },
            {
                title: 'Choose Your Theme',
                content: 'Select a theme that suits your workflow. As long its comfortable :)',
                icon: '🎨',
                themeOptions: [
                    {
                        value: 'dark',
                        label: 'Dark',
                        description: 'Best for long sessions',
                        colors: { bg: '#1e1e1e', accent: '#0e639c', text: '#cccccc' }
                    },
                    {
                        value: 'light',
                        label: 'Light',
                        description: 'Bright and clean',
                        colors: { bg: '#f5f5f5', accent: '#0066cc', text: '#1a1a1a' }
                    },
                    {
                        value: 'oled',
                        label: 'OLED',
                        description: 'Battery saving mode',
                        colors: { bg: '#000000', accent: '#00aaff', text: '#ffffff' }
                    },
                    {
                        value: 'high-contrast',
                        label: 'High Contrast',
                        description: 'Maximum visibility',
                        colors: { bg: '#000000', accent: '#00ff00', text: '#ffffff' }
                    },
                    {
                        value: 'dracula',
                        label: 'Dracula',
                        description: 'Purple and pink',
                        colors: { bg: '#282a36', accent: '#bd93f9', text: '#f8f8f2' },
                        builtin: true
                    },
                    {
                        value: 'monokai',
                        label: 'Monokai',
                        description: 'Classic green',
                        colors: { bg: '#272822', accent: '#a6e22e', text: '#f8f8f2' },
                        builtin: true
                    },
                    {
                        value: 'tokyo-night',
                        label: 'Tokyo Night',
                        description: 'Modern blue',
                        colors: { bg: '#1a1b26', accent: '#7aa2f7', text: '#a9b1d6' },
                        builtin: true
                    },
                    {
                        value: 'nord',
                        label: 'Nord',
                        description: 'Arctic blue',
                        colors: { bg: '#2e3440', accent: '#88c0d0', text: '#d8dee9' },
                        builtin: true
                    },
                    {
                        value: 'solarized-dark',
                        label: 'Solarized',
                        description: 'Precision colors',
                        colors: { bg: '#002b36', accent: '#268bd2', text: '#839496' },
                        builtin: true
                    },
                    {
                        value: 'github-dark',
                        label: 'GitHub',
                        description: 'GitHub official',
                        colors: { bg: '#0d1117', accent: '#238636', text: '#c9d1d9' },
                        builtin: true
                    }
                ],
                setting: 'theme'
            },
            {
                title: 'Audio Settings',
                content: 'Configure your audio preferences.',
                icon: '🔊',
                fields: [
                    { type: 'slider', label: 'Master Volume', setting: 'musicVolume', min: 0, max: 1, step: 0.1, default: 0.5, showPercentage: true },
                    { type: 'slider', label: 'Metronome Volume', setting: 'metronomeVolume', min: 0, max: 1, step: 0.1, default: 0.5, showPercentage: true }
                ]
            },
            {
                title: 'Editor Preferences',
                content: 'Customize your editing experience.',
                icon: '⚙️',
                fields: [
                    { type: 'checkbox', label: 'Enable Auto-save', setting: 'autoSaveEnabled', default: true },
                    {
                        type: 'select', label: 'Snap Division', setting: 'snapDivision', options: [
                            { value: 2, label: '1/2' },
                            { value: 4, label: '1/4' },
                            { value: 8, label: '1/8' },
                            { value: 16, label: '1/16' }
                        ], default: 4
                    }
                ]
            },
            {
                title: 'You\'re All Set!',
                content: 'Start creating amazing charts. You can change these settings anytime in Settings.',
                icon: '🎉',
                isFinal: true,
                tips: [
                    { key: 'Ctrl+Z/Y', desc: 'Undo/Redo' },
                    { key: 'Space', desc: 'Play/Pause' },
                    { key: 'Ctrl+S', desc: 'Save Chart' },
                    { key: 'Ctrl+N', desc: 'New Chart' }
                ]
            }
        ];
    }

    show() {
        if (this.hasCompletedSetup()) {
            return;
        }

        this.createModal();
        this.renderStep();
        this.setupKeyboardNavigation();
    }

    setupKeyboardNavigation() {
        this.keyHandler = (e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
                const nextBtn = document.getElementById('setup-next');
                const acceptBtn = document.getElementById('setup-accept');
                if (nextBtn && nextBtn.style.display !== 'none') {
                    nextBtn.click();
                } else if (acceptBtn && acceptBtn.style.display !== 'none' && !acceptBtn.disabled) {
                    acceptBtn.click();
                }
            } else if (e.key === 'Escape') {
                const backBtn = document.getElementById('setup-back');
                const declineBtn = document.getElementById('setup-decline');
                if (backBtn && backBtn.style.display !== 'none') {
                    backBtn.click();
                } else if (declineBtn && declineBtn.style.display !== 'none') {
                    declineBtn.click();
                }
            }
        };
        document.addEventListener('keydown', this.keyHandler);
    }

    hasCompletedSetup() {
        return localStorage.getItem('dsxStudioSetupComplete') === 'true';
    }

    createModal() {
        // Blur the background
        const appContainer = document.getElementById('app-container');
        if (appContainer) {
            appContainer.style.filter = 'blur(10px)';
            appContainer.style.pointerEvents = 'none';
        }

        const modal = document.createElement('div');
        modal.id = 'first-time-setup-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: transparent;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            font-family: 'Exo 2', 'Segoe UI', sans-serif;
        `;

        modal.innerHTML = `
            <div id="setup-card" style="
                width: 500px;
                background: rgba(255, 255, 255, 0.95);
                border-radius: 12px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                overflow: hidden;
                transition: background 0.3s ease, color 0.3s ease;
            ">
                <div style="
                    display: flex;
                    justify-content: center;
                    gap: 8px;
                    padding: 24px 24px 0;
                " id="setup-progress">
                </div>

                <div style="padding: 40px 48px;">
                    <div style="text-align: center; margin-bottom: 32px;">
                        <div id="setup-icon" style="font-size: 48px; margin-bottom: 16px;"></div>
                        <h2 id="setup-title" style="
                            font-size: 24px;
                            font-weight: 600;
                            color: #1a1a1a;
                            margin: 0 0 12px 0;
                            transition: color 0.3s ease;
                        "></h2>
                        <p id="setup-subtitle" style="
                            font-size: 14px;
                            color: #666;
                            margin: 0 0 8px 0;
                            transition: color 0.3s ease;
                        "></p>
                        <p id="setup-step-counter" style="
                            font-size: 12px;
                            color: #999;
                            margin: 0;
                            transition: color 0.3s ease;
                        "></p>
                    </div>

                    <div id="setup-body" style="min-height: 200px; transition: opacity 0.3s ease, transform 0.3s ease; opacity: 1; transform: scale(1);">
                    </div>
                </div>

                <div id="setup-footer" style="
                    display: flex;
                    justify-content: flex-end;
                    padding: 20px 48px 32px;
                    border-top: 1px solid rgba(0, 0, 0, 0.1);
                    gap: 12px;
                    transition: border-color 0.3s ease;
                ">
                    <button id="setup-back" style="
                        background: #e0e0e0;
                        border: none;
                        color: #333;
                        font-size: 14px;
                        font-weight: 500;
                        cursor: pointer;
                        padding: 10px 24px;
                        border-radius: 6px;
                        display: none;
                        transition: background 0.3s ease, color 0.3s ease;
                    " tabindex="0">Back</button>
                    <button id="setup-next" style="
                        background: #667eea;
                        border: none;
                        color: white;
                        font-size: 14px;
                        font-weight: 500;
                        cursor: pointer;
                        padding: 10px 32px;
                        border-radius: 6px;
                    " tabindex="0">Next</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        document.getElementById('setup-next').addEventListener('click', () => this.nextStep());
        document.getElementById('setup-back').addEventListener('click', () => this.prevStep());
    }

    renderStep() {
        const step = this.steps[this.currentStep];
        const iconEl = document.getElementById('setup-icon');
        const titleEl = document.getElementById('setup-title');
        const subtitleEl = document.getElementById('setup-subtitle');
        const stepCounterEl = document.getElementById('setup-step-counter');
        const bodyEl = document.getElementById('setup-body');
        const nextBtn = document.getElementById('setup-next');
        const backBtn = document.getElementById('setup-back');
        const progressEl = document.getElementById('setup-progress');

        // Add fade-out animation
        bodyEl.style.opacity = '0';
        bodyEl.style.transform = 'scale(0.95)';

        setTimeout(() => {
            // Update progress dots with tooltips
            progressEl.innerHTML = '';
            this.steps.forEach((s, index) => {
                const dot = document.createElement('div');
                dot.title = s.title;
                dot.style.cssText = `
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: ${index === this.currentStep ? '#667eea' : index < this.currentStep ? '#667eea' : 'rgba(0, 0, 0, 0.2)'};
                    transition: all 0.3s ease;
                    cursor: pointer;
                `;
                progressEl.appendChild(dot);
            });

            iconEl.textContent = step.icon;
            titleEl.textContent = step.title;
            subtitleEl.textContent = step.content;

            // Update step counter
            const remaining = this.steps.length - this.currentStep - 1;
            if (remaining > 0) {
                stepCounterEl.textContent = `Step ${this.currentStep + 1} of ${this.steps.length} • ${remaining} more step${remaining > 1 ? 's' : ''}`;
            } else {
                stepCounterEl.textContent = `Final step`;
            }

            let bodyHTML = '';

            // Render welcome screen with features
            if (step.features) {
                bodyHTML += '<div style="display: flex; flex-direction: column; gap: 16px; margin-top: 16px;">';
                step.features.forEach(feature => {
                    bodyHTML += `
                    <div style="
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        padding: 16px;
                        background: rgba(102, 126, 234, 0.05);
                        border-radius: 8px;
                        border: 2px solid rgba(102, 126, 234, 0.1);
                        transition: all 0.2s;
                    " class="feature-item">
                        <div style="font-size: 24px;">${feature.icon}</div>
                        <div style="font-weight: 500; font-size: 14px;">${feature.text}</div>
                    </div>
                    `;
                });
                bodyHTML += '</div>';
                bodyHTML += `<div style="text-align: center; margin-top: 20px; font-size: 12px; color: #999;">Version 4.0 RELEASE (30/1/2026)</div>`;
            }

            // Render EULA content
            if (step.isEULA) {
                bodyHTML += `
                <div style="
                    background: rgba(0, 0, 0, 0.05);
                    border: 2px solid #e0e0e0;
                    border-radius: 8px;
                    padding: 20px;
                    max-height: 300px;
                    overflow-y: auto;
                    font-size: 13px;
                    line-height: 1.6;
                    color: #333;
                    transition: all 0.3s ease;
                    position: relative;
                " id="eula-content">
                    <div style="
                        position: sticky;
                        top: 0;
                        background: inherit;
                        padding-bottom: 8px;
                        margin-bottom: 8px;
                        z-index: 1;
                    ">
                        <div style="
                            height: 4px;
                            background: #e0e0e0;
                            border-radius: 2px;
                            overflow: hidden;
                        ">
                            <div id="eula-scroll-progress" style="
                                height: 100%;
                                width: 0%;
                                background: #667eea;
                                transition: width 0.1s ease;
                            "></div>
                        </div>
                    </div>
                    <h3 style="margin-top: 0; font-size: 16px; font-weight: 600;">END USER LICENSE AGREEMENT</h3>
                    
                    <p><strong>Last Updated:</strong> January 30, 2026</p>
                    
                    <p>This End User License Agreement ("Agreement") is a legal agreement between you ("User", "You") and Redevon Studios / Kynix Teams ("Licensor", "We", "Us") for the use of DreamSync Studio 4 ("Software", "Application").</p>
                    
                    <p><strong>BY CLICKING "ACCEPT" OR BY INSTALLING, COPYING, OR OTHERWISE USING THE SOFTWARE, YOU AGREE TO BE BOUND BY THE TERMS OF THIS AGREEMENT. IF YOU DO NOT AGREE TO THE TERMS OF THIS AGREEMENT, CLICK "DECLINE" AND DO NOT INSTALL OR USE THE SOFTWARE.</strong></p>

                    <h4 style="margin-top: 20px; font-size: 14px; font-weight: 600;">1. LICENSE GRANT</h4>
                    <p>Subject to the terms and conditions of this Agreement, Licensor grants You a non-exclusive, non-transferable, revocable license to:</p>
                    <ul style="margin: 8px 0; padding-left: 20px;">
                        <li>Install and use the Software on any number of computers You own or control</li>
                        <li>Create, edit, and export rhythm game charts using the Software</li>
                        <li>Use the Software for personal, educational, or commercial purposes</li>
                        <li>Use the AI auto-mapping features and train custom models</li>
                    </ul>

                    <h4 style="margin-top: 20px; font-size: 14px; font-weight: 600;">2. RESTRICTIONS</h4>
                    <p>You may NOT:</p>
                    <ul style="margin: 8px 0; padding-left: 20px;">
                        <li>Reverse engineer, decompile, disassemble, or attempt to derive the source code of the Software</li>
                        <li>Remove, alter, or obscure any copyright, trademark, or other proprietary rights notices</li>
                        <li>Distribute, sell, lease, rent, lend, or sublicense the Software to third parties</li>
                        <li>Use the Software to create content that violates applicable laws or infringes on third-party rights</li>
                        <li>Modify, adapt, translate, or create derivative works based on the Software</li>
                        <li>Use the Software in any manner that could damage, disable, overburden, or impair the Software</li>
                    </ul>

                    <h4 style="margin-top: 20px; font-size: 14px; font-weight: 600;">3. INTELLECTUAL PROPERTY RIGHTS</h4>
                    <p>The Software is licensed, not sold. Redevon Studios and Kynix Teams retain all rights, title, and interest in and to the Software, including all intellectual property rights. This Agreement does not grant You any rights to trademarks, service marks, or trade names of the Licensor.</p>

                    <h4 style="margin-top: 20px; font-size: 14px; font-weight: 600;">4. USER-GENERATED CONTENT</h4>
                    <p>You retain all rights to charts, beatmaps, and other content You create using the Software ("User Content"). The Licensor claims no ownership over Your User Content. You are solely responsible for Your User Content and the consequences of posting or publishing it.</p>
                    <p>You represent and warrant that You own or have the necessary rights to use and authorize the use of Your User Content, including any audio files used in chart creation.</p>

                    <h4 style="margin-top: 20px; font-size: 14px; font-weight: 600;">5. THIRD-PARTY COMPONENTS</h4>
                    <p>The Software incorporates the following third-party components, each subject to their respective licenses:</p>
                    
                    <p style="margin-top: 12px;"><strong>Electron Framework</strong><br>
                    Copyright (c) Electron contributors<br>
                    Licensed under the MIT License</p>
                    
                    <p style="margin-top: 12px;"><strong>PixiJS (v7.2.4)</strong><br>
                    Copyright (c) 2013-2023 Mathew Groves, Chad Engler<br>
                    Licensed under the MIT License<br>
                    Used for graphics rendering and visual timeline</p>
                    
                    <p style="margin-top: 12px;"><strong>Anime.js</strong><br>
                    Copyright (c) Julian Garnier<br>
                    Licensed under the MIT License<br>
                    Used for UI animations</p>
                    
                    <p style="margin-top: 12px;"><strong>Exo 2 Font</strong><br>
                    Copyright (c) Natanael Gama<br>
                    Licensed under the SIL Open Font License 1.1<br>
                    Used for application typography</p>
                    
                    <p style="margin-top: 12px;"><strong>Zen Maru Gothic Font</strong><br>
                    Copyright (c) Yoshimichi Ohira<br>
                    Licensed under the SIL Open Font License 1.1<br>
                    Used for Japanese text support</p>

                    <p style="margin-top: 12px;">Full license texts for these components are available in the Software's installation directory. Your use of the Software constitutes acceptance of these third-party licenses.</p>

                    <h4 style="margin-top: 20px; font-size: 14px; font-weight: 600;">6. DATA COLLECTION AND PRIVACY</h4>
                    <p>The Software stores user preferences, chart data, and AI training models locally on Your device using browser localStorage. No personal data is transmitted to external servers unless You explicitly use online features (such as RLIS integration). We do not collect, store, or share Your personal information without Your consent.</p>

                    <h4 style="margin-top: 20px; font-size: 14px; font-weight: 600;">7. AI TRAINING AND MODELS</h4>
                    <p>The Software includes AI-powered auto-mapping features. When You train custom AI models using beatmap data:</p>
                    <ul style="margin: 8px 0; padding-left: 20px;">
                        <li>You are responsible for ensuring You have the right to use the training data</li>
                        <li>Trained models are stored locally on Your device</li>
                        <li>You retain ownership of Your trained models</li>
                        <li>The Licensor is not responsible for the quality or accuracy of AI-generated content</li>
                    </ul>

                    <h4 style="margin-top: 20px; font-size: 14px; font-weight: 600;">8. UPDATES AND MODIFICATIONS</h4>
                    <p>The Licensor may provide updates, patches, or modifications to the Software. Such updates may be automatically downloaded and installed. You agree that the Licensor has no obligation to provide any updates or continue to provide or enable any particular features or functionality.</p>

                    <h4 style="margin-top: 20px; font-size: 14px; font-weight: 600;">9. DISCLAIMER OF WARRANTIES</h4>
                    <p><strong>THE SOFTWARE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.</strong></p>
                    <p>The Licensor does not warrant that:</p>
                    <ul style="margin: 8px 0; padding-left: 20px;">
                        <li>The Software will meet Your requirements or expectations</li>
                        <li>The Software will be uninterrupted, timely, secure, or error-free</li>
                        <li>The results obtained from the use of the Software will be accurate or reliable</li>
                        <li>Any errors in the Software will be corrected</li>
                    </ul>

                    <h4 style="margin-top: 20px; font-size: 14px; font-weight: 600;">10. LIMITATION OF LIABILITY</h4>
                    <p><strong>TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL THE LICENSOR, ITS AFFILIATES, OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, OR SUPPLIERS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION, LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM:</strong></p>
                    <ul style="margin: 8px 0; padding-left: 20px;">
                        <li>Your access to or use of or inability to access or use the Software</li>
                        <li>Any conduct or content of any third party on or through the Software</li>
                        <li>Any content obtained from the Software</li>
                        <li>Unauthorized access, use, or alteration of Your transmissions or content</li>
                    </ul>
                    <p><strong>IN NO EVENT SHALL THE LICENSOR'S TOTAL LIABILITY TO YOU FOR ALL DAMAGES, LOSSES, OR CAUSES OF ACTION EXCEED THE AMOUNT YOU PAID FOR THE SOFTWARE (IF ANY) OR ONE HUNDRED DOLLARS ($100), WHICHEVER IS LESS.</strong></p>

                    <h4 style="margin-top: 20px; font-size: 14px; font-weight: 600;">11. INDEMNIFICATION</h4>
                    <p>You agree to indemnify, defend, and hold harmless the Licensor and its affiliates, officers, directors, employees, agents, and suppliers from and against any claims, liabilities, damages, losses, costs, expenses, or fees (including reasonable attorneys' fees) arising from:</p>
                    <ul style="margin: 8px 0; padding-left: 20px;">
                        <li>Your use of the Software</li>
                        <li>Your violation of this Agreement</li>
                        <li>Your violation of any rights of another party</li>
                        <li>Your User Content</li>
                    </ul>

                    <h4 style="margin-top: 20px; font-size: 14px; font-weight: 600;">12. TERMINATION</h4>
                    <p>This Agreement is effective until terminated. Your rights under this Agreement will terminate automatically without notice if You fail to comply with any term of this Agreement. Upon termination, You must cease all use of the Software and destroy all copies in Your possession or control.</p>
                    <p>The Licensor reserves the right to terminate this Agreement and Your access to the Software at any time, with or without cause, with or without notice.</p>

                    <h4 style="margin-top: 20px; font-size: 14px; font-weight: 600;">13. EXPORT COMPLIANCE</h4>
                    <p>You agree to comply with all applicable export and import laws and regulations. You shall not export, re-export, or transfer the Software to any prohibited country, entity, or person.</p>

                    <h4 style="margin-top: 20px; font-size: 14px; font-weight: 600;">14. GOVERNING LAW AND JURISDICTION</h4>
                    <p>This Agreement shall be governed by and construed in accordance with the laws of the jurisdiction in which the Licensor is established, without regard to its conflict of law provisions. Any legal action or proceeding arising under this Agreement shall be brought exclusively in the courts of that jurisdiction.</p>

                    <h4 style="margin-top: 20px; font-size: 14px; font-weight: 600;">15. SEVERABILITY</h4>
                    <p>If any provision of this Agreement is held to be invalid or unenforceable, the remaining provisions shall continue in full force and effect. The invalid or unenforceable provision shall be replaced with a valid provision that most closely approximates the intent of the original provision.</p>

                    <h4 style="margin-top: 20px; font-size: 14px; font-weight: 600;">16. ENTIRE AGREEMENT</h4>
                    <p>This Agreement constitutes the entire agreement between You and the Licensor regarding the Software and supersedes all prior or contemporaneous understandings and agreements, whether written or oral, regarding the Software.</p>

                    <h4 style="margin-top: 20px; font-size: 14px; font-weight: 600;">17. AMENDMENTS</h4>
                    <p>The Licensor reserves the right to modify this Agreement at any time. We will notify You of any changes by posting the new Agreement on our website or within the Software. Your continued use of the Software after such modifications constitutes Your acceptance of the updated Agreement.</p>

                    <h4 style="margin-top: 20px; font-size: 14px; font-weight: 600;">18. CONTACT INFORMATION</h4>
                    <p>For questions about this Agreement, please contact:<br>
                    <strong>Redevon Studios / Kynix Teams</strong><br>
                    Email: redevoncommunity@gmail.com</p>

                    <h4 style="margin-top: 20px; font-size: 14px; font-weight: 600;">19. ACKNOWLEDGMENT</h4>
                    <p style="margin-top: 16px; padding: 16px; background: rgba(102, 126, 234, 0.1); border-radius: 6px; font-weight: 600;">BY CLICKING "ACCEPT" BELOW, YOU ACKNOWLEDGE THAT YOU HAVE READ THIS AGREEMENT, UNDERSTAND IT, AND AGREE TO BE BOUND BY ITS TERMS AND CONDITIONS. YOU FURTHER AGREE THAT THIS AGREEMENT IS THE COMPLETE AND EXCLUSIVE STATEMENT OF THE AGREEMENT BETWEEN YOU AND THE LICENSOR, AND SUPERSEDES ANY PROPOSAL OR PRIOR AGREEMENT, ORAL OR WRITTEN, AND ANY OTHER COMMUNICATIONS RELATING TO THE SUBJECT MATTER OF THIS AGREEMENT.</p>
                </div>
                <div style="
                    margin-top: 12px;
                    display: none;
                    align-items: center;
                    gap: 8px;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                " id="eula-checkbox-container">
                    <input type="checkbox" id="eula-checkbox" style="
                        width: 18px;
                        height: 18px;
                        accent-color: #667eea;
                        cursor: pointer;
                    " tabindex="0">
                    <label for="eula-checkbox" style="
                        font-size: 13px;
                        color: #666;
                        cursor: pointer;
                        user-select: none;
                    ">I have read and agree to the terms</label>
                </div>
                <div style="
                    margin-top: 8px;
                    padding: 8px 12px;
                    background: rgba(102, 126, 234, 0.1);
                    border-radius: 6px;
                    font-size: 12px;
                    color: #667eea;
                    text-align: center;
                    transition: opacity 0.3s ease;
                " id="eula-scroll-hint">
                    📜 Please scroll to the bottom and check the box to enable Accept
                </div>
                `;
            }

            // Render theme options with preview panels
            if (step.themeOptions) {
                // Show first 4 themes
                bodyHTML += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;" id="basic-themes">';
                step.themeOptions.slice(0, 4).forEach(option => {
                    bodyHTML += `
                    <label style="
                        display: flex;
                        flex-direction: column;
                        cursor: pointer;
                        transition: all 0.2s;
                    " class="setup-theme-option" data-theme="${option.value}">
                        <div style="
                            background: ${option.colors.bg};
                            border: 3px solid #e0e0e0;
                            border-radius: 8px;
                            padding: 16px;
                            height: 100px;
                            display: flex;
                            flex-direction: column;
                            gap: 8px;
                            transition: all 0.2s;
                            position: relative;
                            overflow: hidden;
                        " class="theme-preview">
                            <div style="
                                background: ${option.colors.accent};
                                height: 8px;
                                width: 60%;
                                border-radius: 4px;
                            "></div>
                            <div style="
                                background: ${option.colors.text};
                                opacity: 0.3;
                                height: 6px;
                                width: 80%;
                                border-radius: 3px;
                            "></div>
                            <div style="
                                background: ${option.colors.text};
                                opacity: 0.3;
                                height: 6px;
                                width: 50%;
                                border-radius: 3px;
                            "></div>
                            <input type="radio" name="${step.setting}" value="${option.value}" style="
                                position: absolute;
                                top: 8px;
                                right: 8px;
                                width: 20px;
                                height: 20px;
                                accent-color: #667eea;
                            ">
                        </div>
                        <div style="
                            margin-top: 8px;
                            text-align: center;
                        " class="theme-label-container">
                            <div class="theme-label-title" style="font-weight: 600; margin-bottom: 2px; transition: color 0.3s ease;">${option.label}</div>
                            <div class="theme-label-desc" style="font-size: 12px; transition: color 0.3s ease;">${option.description}</div>
                        </div>
                    </label>
                `;
                });
                bodyHTML += '</div>';

                // Add "More Themes" button if there are more than 4 themes
                if (step.themeOptions.length > 4) {
                    bodyHTML += `
                    <button id="more-themes-btn" style="
                        margin-top: 16px;
                        padding: 8px 16px;
                        background: transparent;
                        border: 2px solid #667eea;
                        color: #667eea;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 13px;
                        font-weight: 600;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        transition: all 0.2s;
                        width: fit-content;
                        margin-left: auto;
                        margin-right: auto;
                    " onmouseover="this.style.background='#667eea'; this.style.color='white';" onmouseout="this.style.background='transparent'; this.style.color='#667eea';">
                        More Themes
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="transition: transform 0.2s;" id="more-themes-arrow">
                            <path d="M7 10l5 5 5-5z"/>
                        </svg>
                    </button>
                    `;

                    // Add collapsible section for additional themes
                    bodyHTML += '<div id="more-themes-section" style="display: none; margin-top: 16px;">';
                    bodyHTML += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">';

                    step.themeOptions.slice(4).forEach(option => {
                        bodyHTML += `
                        <label style="
                            display: flex;
                            flex-direction: column;
                            cursor: pointer;
                            transition: all 0.2s;
                        " class="setup-theme-option" data-theme="${option.value}" data-builtin="${option.builtin || false}">
                            <div style="
                                background: ${option.colors.bg};
                                border: 3px solid #e0e0e0;
                                border-radius: 8px;
                                padding: 16px;
                                height: 100px;
                                display: flex;
                                flex-direction: column;
                                gap: 8px;
                                transition: all 0.2s;
                                position: relative;
                                overflow: hidden;
                            " class="theme-preview">
                                <div style="
                                    background: ${option.colors.accent};
                                    height: 8px;
                                    width: 60%;
                                    border-radius: 4px;
                                "></div>
                                <div style="
                                    background: ${option.colors.text};
                                    opacity: 0.3;
                                    height: 6px;
                                    width: 80%;
                                    border-radius: 3px;
                                "></div>
                                <div style="
                                    background: ${option.colors.text};
                                    opacity: 0.3;
                                    height: 6px;
                                    width: 50%;
                                    border-radius: 3px;
                                "></div>
                                <input type="radio" name="${step.setting}" value="${option.value}" style="
                                    position: absolute;
                                    top: 8px;
                                    right: 8px;
                                    width: 20px;
                                    height: 20px;
                                    accent-color: #667eea;
                                ">
                            </div>
                            <div style="
                                margin-top: 8px;
                                text-align: center;
                            " class="theme-label-container">
                                <div class="theme-label-title" style="font-weight: 600; margin-bottom: 2px; transition: color 0.3s ease;">${option.label}</div>
                                <div class="theme-label-desc" style="font-size: 12px; transition: color 0.3s ease;">${option.description}</div>
                            </div>
                        </label>
                    `;
                    });

                    bodyHTML += '</div></div>';
                }
            }

            // Render options (for non-theme steps)
            if (step.options) {
                bodyHTML += '<div style="display: flex; flex-direction: column; gap: 12px;">';
                step.options.forEach(option => {
                    bodyHTML += `
                    <label style="
                        display: flex;
                        align-items: center;
                        padding: 16px;
                        border: 2px solid #e0e0e0;
                        border-radius: 8px;
                        cursor: pointer;
                        transition: all 0.2s;
                    " class="setup-option">
                        <input type="radio" name="${step.setting}" value="${option.value}" style="
                            margin-right: 12px;
                            width: 20px;
                            height: 20px;
                            accent-color: #667eea;
                        ">
                        <div>
                            <div style="font-weight: 500; color: #1a1a1a; margin-bottom: 4px;">${option.label}</div>
                            <div style="font-size: 13px; color: #666;">${option.description}</div>
                        </div>
                    </label>
                `;
                });
                bodyHTML += '</div>';
            }

            // Render fields
            if (step.fields) {
                bodyHTML += '<div style="display: flex; flex-direction: column; gap: 20px;">';
                step.fields.forEach(field => {
                    bodyHTML += `<div>`;
                    bodyHTML += `<label style="display: block; font-weight: 500; color: #1a1a1a; margin-bottom: 8px;">${field.label}</label>`;

                    if (field.type === 'slider') {
                        const displayValue = field.showPercentage ? `${Math.round(field.default * 100)}%` : field.default;
                        bodyHTML += `
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <input type="range" data-setting="${field.setting}" min="${field.min}" max="${field.max}" step="${field.step}" value="${field.default}" data-show-percentage="${field.showPercentage || false}" style="
                                flex: 1;
                                height: 6px;
                                border-radius: 3px;
                                background: #e0e0e0;
                                outline: none;
                                accent-color: #667eea;
                            ">
                            <span class="slider-value" style="
                                min-width: 50px;
                                text-align: right;
                                font-weight: 500;
                                color: #667eea;
                            ">${displayValue}</span>
                        </div>
                    `;
                    } else if (field.type === 'checkbox') {
                        bodyHTML += `<label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="checkbox" data-setting="${field.setting}" ${field.default ? 'checked' : ''} style="
                            width: 20px;
                            height: 20px;
                            margin-right: 8px;
                            accent-color: #667eea;
                        ">
                        <span style="color: #666;">Enable this feature</span>
                    </label>`;
                    } else if (field.type === 'select') {
                        bodyHTML += `<select data-setting="${field.setting}" style="
                        width: 100%;
                        padding: 10px 12px;
                        border: 2px solid #e0e0e0;
                        border-radius: 6px;
                        font-size: 14px;
                        background: white;
                    ">`;
                        field.options.forEach(opt => {
                            bodyHTML += `<option value="${opt.value}" ${opt.value === field.default ? 'selected' : ''}>${opt.label}</option>`;
                        });
                        bodyHTML += `</select>`;
                    }

                    bodyHTML += `</div>`;
                });
                bodyHTML += '</div>';
            }

            // Render final screen tips
            if (step.tips) {
                bodyHTML += '<div style="margin-top: 24px;"><h4 style="font-size: 14px; font-weight: 600; margin-bottom: 16px; text-align: center;">Quick Keyboard Shortcuts</h4>';
                bodyHTML += '<div style="display: flex; flex-direction: column; gap: 12px;">';
                step.tips.forEach(tip => {
                    bodyHTML += `
                    <div style="
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 12px 16px;
                        background: rgba(102, 126, 234, 0.05);
                        border-radius: 6px;
                        border: 1px solid rgba(102, 126, 234, 0.1);
                    ">
                        <span style="font-family: 'Courier New', monospace; font-weight: 600; color: #667eea;">${tip.key}</span>
                        <span style="color: #666; font-size: 13px;">${tip.desc}</span>
                    </div>
                    `;
                });
                bodyHTML += '</div></div>';
            }

            bodyEl.innerHTML = bodyHTML;

            // Add hover effects and auto-apply for theme options
            bodyEl.querySelectorAll('.setup-theme-option').forEach(option => {
                const input = option.querySelector('input[type="radio"]');
                const preview = option.querySelector('.theme-preview');
                const themeValue = option.dataset.theme;

                option.addEventListener('mouseover', () => {
                    preview.style.borderColor = '#667eea';
                    preview.style.transform = 'scale(1.02)';
                });
                option.addEventListener('mouseout', () => {
                    if (!input.checked) {
                        preview.style.borderColor = '#e0e0e0';
                        preview.style.transform = 'scale(1)';
                    }
                });
                input.addEventListener('change', async () => {
                    bodyEl.querySelectorAll('.theme-preview').forEach(p => {
                        p.style.borderColor = '#e0e0e0';
                        p.style.transform = 'scale(1)';
                    });
                    preview.style.borderColor = '#667eea';
                    preview.style.transform = 'scale(1.02)';

                    // Check if this is a built-in theme
                    const themeOption = step.themeOptions.find(opt => opt.value === themeValue);
                    const isBuiltin = themeOption && themeOption.builtin;

                    if (isBuiltin) {
                        // Load and apply built-in theme
                        try {
                            const response = await fetch(`./assets/themes/${themeValue}.json`);
                            if (!response.ok) throw new Error('Theme not found');

                            const themeData = await response.json();

                            // Map and apply the theme
                            const mappedTheme = this.editor.themeImporter.mapVSCodeTheme(themeData.colors, themeData.name);
                            this.editor.themeImporter.applyCustomTheme(mappedTheme);

                            // Save to localStorage
                            localStorage.setItem('customTheme', JSON.stringify(mappedTheme));
                        } catch (error) {
                        }
                    } else {
                        // Auto-apply standard theme immediately
                        this.editor._applyTheme(themeValue);
                    }

                    // Update setup modal card to match theme
                    this.updateModalTheme(themeValue);

                    // Save to settings
                    const modalSettings = JSON.parse(localStorage.getItem('editorSettings') || '{}');
                    modalSettings.theme = themeValue;
                    localStorage.setItem('editorSettings', JSON.stringify(modalSettings));
                });
            });

            // Add "More Themes" button toggle
            const moreThemesBtn = document.getElementById('more-themes-btn');
            const moreThemesSection = document.getElementById('more-themes-section');
            const moreThemesArrow = document.getElementById('more-themes-arrow');
            const basicThemes = document.getElementById('basic-themes');

            if (moreThemesBtn && moreThemesSection && basicThemes) {
                let isExpanded = false;
                moreThemesBtn.addEventListener('click', () => {
                    isExpanded = !isExpanded;
                    if (isExpanded) {
                        // Hide basic themes
                        basicThemes.style.display = 'none';

                        // Show more themes
                        moreThemesSection.style.display = 'block';
                        moreThemesArrow.style.transform = 'rotate(180deg)';
                        moreThemesBtn.innerHTML = `
                            Less Themes
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="transition: transform 0.2s; transform: rotate(180deg);" id="more-themes-arrow">
                                <path d="M7 10l5 5 5-5z"/>
                            </svg>
                        `;
                    } else {
                        // Show basic themes
                        basicThemes.style.display = 'grid';

                        // Hide more themes
                        moreThemesSection.style.display = 'none';
                        moreThemesArrow.style.transform = 'rotate(0deg)';
                        moreThemesBtn.innerHTML = `
                            More Themes
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="transition: transform 0.2s;" id="more-themes-arrow">
                                <path d="M7 10l5 5 5-5z"/>
                            </svg>
                        `;
                    }
                });
            }

            // Add hover effects for regular options
            bodyEl.querySelectorAll('.setup-option').forEach(option => {
                const input = option.querySelector('input[type="radio"]');
                option.addEventListener('mouseover', () => option.style.borderColor = '#667eea');
                option.addEventListener('mouseout', () => {
                    if (!input.checked) option.style.borderColor = '#e0e0e0';
                });
                input.addEventListener('change', () => {
                    bodyEl.querySelectorAll('.setup-option').forEach(o => o.style.borderColor = '#e0e0e0');
                    option.style.borderColor = '#667eea';
                });
            });

            // Update button states
            backBtn.style.display = this.currentStep > 0 ? 'block' : 'none';
            nextBtn.textContent = this.currentStep === this.steps.length - 1 ? 'Get Started' : 'Next';

            // Handle EULA step with custom buttons
            if (step.isEULA) {
                // Hide standard buttons
                backBtn.style.display = 'none';
                nextBtn.style.display = 'none';

                // Create custom EULA buttons if they don't exist
                let declineBtn = document.getElementById('setup-decline');
                let acceptBtn = document.getElementById('setup-accept');

                if (!declineBtn) {
                    declineBtn = document.createElement('button');
                    declineBtn.id = 'setup-decline';
                    declineBtn.textContent = 'Decline';
                    declineBtn.style.cssText = `
                        background: #e0e0e0;
                        border: none;
                        color: #333;
                        font-size: 14px;
                        font-weight: 500;
                        cursor: pointer;
                        padding: 10px 24px;
                        border-radius: 6px;
                        transition: background 0.3s ease, color 0.3s ease;
                    `;
                    declineBtn.addEventListener('click', () => this.prevStep());
                    document.getElementById('setup-footer').appendChild(declineBtn);
                }

                if (!acceptBtn) {
                    acceptBtn = document.createElement('button');
                    acceptBtn.id = 'setup-accept';
                    acceptBtn.textContent = 'Accept';
                    acceptBtn.style.cssText = `
                        background: #667eea;
                        border: none;
                        color: white;
                        font-size: 14px;
                        font-weight: 500;
                        cursor: pointer;
                        padding: 10px 32px;
                        border-radius: 6px;
                        transition: all 0.3s ease;
                    `;
                    acceptBtn.addEventListener('click', () => this.nextStep());
                    document.getElementById('setup-footer').appendChild(acceptBtn);
                }

                // Disable Accept button initially
                acceptBtn.disabled = true;
                acceptBtn.style.opacity = '0.5';
                acceptBtn.style.cursor = 'not-allowed';

                declineBtn.style.display = 'block';
                acceptBtn.style.display = 'block';

                // Add scroll listener to enable Accept button when user reaches bottom
                const eulaContent = document.getElementById('eula-content');
                const scrollHint = document.getElementById('eula-scroll-hint');
                const eulaCheckbox = document.getElementById('eula-checkbox');
                const eulaCheckboxContainer = document.getElementById('eula-checkbox-container');
                const eulaScrollProgress = document.getElementById('eula-scroll-progress');

                if (eulaContent) {
                    const checkScrollAndCheckbox = () => {
                        // Update progress bar
                        const scrollPercentage = (eulaContent.scrollTop / (eulaContent.scrollHeight - eulaContent.clientHeight)) * 100;
                        if (eulaScrollProgress) {
                            eulaScrollProgress.style.width = `${Math.min(scrollPercentage, 100)}%`;
                        }

                        const isAtBottom = eulaContent.scrollHeight - eulaContent.scrollTop <= eulaContent.clientHeight + 5;
                        const isChecked = eulaCheckbox && eulaCheckbox.checked;

                        // Show checkbox when scrolled to bottom
                        if (isAtBottom && eulaCheckboxContainer) {
                            eulaCheckboxContainer.style.display = 'flex';
                            setTimeout(() => {
                                eulaCheckboxContainer.style.opacity = '1';
                            }, 50);
                            if (scrollHint) {
                                scrollHint.style.opacity = '0';
                                setTimeout(() => {
                                    scrollHint.style.display = 'none';
                                    scrollHint.textContent = '✓ Now check the box above to continue';
                                    scrollHint.style.display = 'block';
                                    scrollHint.style.opacity = '1';
                                }, 300);
                            }
                        }

                        if (isAtBottom && isChecked) {
                            acceptBtn.disabled = false;
                            acceptBtn.style.opacity = '1';
                            acceptBtn.style.cursor = 'pointer';
                        } else {
                            acceptBtn.disabled = true;
                            acceptBtn.style.opacity = '0.5';
                            acceptBtn.style.cursor = 'not-allowed';
                        }
                    };

                    eulaContent.addEventListener('scroll', checkScrollAndCheckbox);
                    if (eulaCheckbox) {
                        eulaCheckbox.addEventListener('change', checkScrollAndCheckbox);
                    }
                    // Check immediately in case content doesn't need scrolling
                    setTimeout(checkScrollAndCheckbox, 100);
                }
            } else {
                // Hide EULA buttons if they exist
                const declineBtn = document.getElementById('setup-decline');
                const acceptBtn = document.getElementById('setup-accept');
                if (declineBtn) declineBtn.style.display = 'none';
                if (acceptBtn) acceptBtn.style.display = 'none';

                // Show standard buttons
                nextBtn.style.display = 'block';
            }

            // Add event listeners for sliders
            bodyEl.querySelectorAll('input[type="range"]').forEach(slider => {
                const valueSpan = slider.nextElementSibling;
                const showPercentage = slider.dataset.showPercentage === 'true';
                slider.addEventListener('input', (e) => {
                    const value = parseFloat(e.target.value);
                    valueSpan.textContent = showPercentage ? `${Math.round(value * 100)}%` : value;
                });
            });

            // Apply current theme to new step content
            const currentTheme = JSON.parse(localStorage.getItem('editorSettings') || '{}').theme || 'dark';
            this.updateModalTheme(currentTheme);

            // Fade in with scale animation
            setTimeout(() => {
                bodyEl.style.opacity = '1';
                bodyEl.style.transform = 'scale(1)';
            }, 50);
        }, 200);
    }

    nextStep() {
        this.saveStepSettings();

        if (this.currentStep === this.steps.length - 1) {
            this.completeSetup();
        } else {
            this.currentStep++;
            this.renderStep();
        }
    }

    prevStep() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.renderStep();
        }
    }

    saveStepSettings() {
        const step = this.steps[this.currentStep];
        const bodyEl = document.getElementById('setup-body');

        if (step.setting && step.themeOptions) {
            // Theme was already applied on selection, just save to editor settings
            const selected = bodyEl.querySelector(`input[name="${step.setting}"]:checked`);
            if (selected) {
                this.editor._settings[step.setting] = selected.value;
            }
        } else if (step.setting) {
            const selected = bodyEl.querySelector(`input[name="${step.setting}"]:checked`);
            if (selected) {
                this.editor._settings[step.setting] = selected.value;
            }
        }

        if (step.fields) {
            step.fields.forEach(field => {
                const input = bodyEl.querySelector(`[data-setting="${field.setting}"]`);
                if (input) {
                    if (input.type === 'checkbox') {
                        this.editor._settings[field.setting] = input.checked;
                    } else if (input.type === 'number' || input.type === 'range') {
                        this.editor._settings[field.setting] = parseFloat(input.value);
                    } else {
                        this.editor._settings[field.setting] = input.value;
                    }
                }
            });
        }

        this.editor._saveSettings();
    }

    completeSetup() {
        localStorage.setItem('dsxStudioSetupComplete', 'true');

        // Remove keyboard listener
        if (this.keyHandler) {
            document.removeEventListener('keydown', this.keyHandler);
        }

        // Remove blur from background
        const appContainer = document.getElementById('app-container');
        if (appContainer) {
            appContainer.style.filter = '';
            appContainer.style.pointerEvents = '';
        }

        const modal = document.getElementById('first-time-setup-modal');
        if (modal) {
            modal.remove();
        }
    }

    updateModalTheme(theme) {
        const card = document.getElementById('setup-card');
        const title = document.getElementById('setup-title');
        const subtitle = document.getElementById('setup-subtitle');
        const footer = document.getElementById('setup-footer');
        const backBtn = document.getElementById('setup-back');
        const eulaContent = document.getElementById('eula-content');

        if (!card) return;

        if (theme === 'light') {
            card.style.background = 'rgba(255, 255, 255, 0.95)';
            title.style.color = '#1a1a1a';
            subtitle.style.color = '#666';
            footer.style.borderTopColor = 'rgba(0, 0, 0, 0.1)';
            backBtn.style.background = '#e0e0e0';
            backBtn.style.color = '#333';

            if (eulaContent) {
                eulaContent.style.background = 'rgba(0, 0, 0, 0.05)';
                eulaContent.style.borderColor = '#e0e0e0';
                eulaContent.style.color = '#333';
            }

            // Update all labels and text
            document.querySelectorAll('.theme-label-title').forEach(el => el.style.color = '#1a1a1a');
            document.querySelectorAll('.theme-label-desc').forEach(el => el.style.color = '#666');
            document.querySelectorAll('#setup-body label').forEach(el => el.style.color = '#1a1a1a');
            document.querySelectorAll('#setup-body .slider-value').forEach(el => el.style.color = '#667eea');
        } else if (theme === 'oled') {
            card.style.background = 'rgba(0, 0, 0, 0.95)';
            title.style.color = '#ffffff';
            subtitle.style.color = '#999999';
            footer.style.borderTopColor = 'rgba(255, 255, 255, 0.1)';
            backBtn.style.background = '#1a1a1a';
            backBtn.style.color = '#ffffff';

            if (eulaContent) {
                eulaContent.style.background = 'rgba(255, 255, 255, 0.05)';
                eulaContent.style.borderColor = '#333333';
                eulaContent.style.color = '#ffffff';
            }

            // Update all labels and text
            document.querySelectorAll('.theme-label-title').forEach(el => el.style.color = '#ffffff');
            document.querySelectorAll('.theme-label-desc').forEach(el => el.style.color = '#999999');
            document.querySelectorAll('#setup-body label').forEach(el => el.style.color = '#ffffff');
            document.querySelectorAll('#setup-body .slider-value').forEach(el => el.style.color = '#00aaff');
        } else if (theme === 'high-contrast') {
            card.style.background = 'rgba(0, 0, 0, 0.95)';
            title.style.color = '#ffffff';
            subtitle.style.color = '#cccccc';
            footer.style.borderTopColor = 'rgba(255, 255, 255, 0.2)';
            backBtn.style.background = '#1a1a1a';
            backBtn.style.color = '#ffffff';

            if (eulaContent) {
                eulaContent.style.background = 'rgba(255, 255, 255, 0.05)';
                eulaContent.style.borderColor = '#444444';
                eulaContent.style.color = '#ffffff';
            }

            // Update all labels and text
            document.querySelectorAll('.theme-label-title').forEach(el => el.style.color = '#ffffff');
            document.querySelectorAll('.theme-label-desc').forEach(el => el.style.color = '#cccccc');
            document.querySelectorAll('#setup-body label').forEach(el => el.style.color = '#ffffff');
            document.querySelectorAll('#setup-body .slider-value').forEach(el => el.style.color = '#00ff00');
        } else {
            // Dark theme
            card.style.background = 'rgba(30, 30, 30, 0.95)';
            title.style.color = '#cccccc';
            subtitle.style.color = '#858585';
            footer.style.borderTopColor = 'rgba(255, 255, 255, 0.1)';
            backBtn.style.background = '#3e3e42';
            backBtn.style.color = '#cccccc';

            if (eulaContent) {
                eulaContent.style.background = 'rgba(255, 255, 255, 0.05)';
                eulaContent.style.borderColor = '#3e3e42';
                eulaContent.style.color = '#cccccc';
            }

            // Update all labels and text
            document.querySelectorAll('.theme-label-title').forEach(el => el.style.color = '#cccccc');
            document.querySelectorAll('.theme-label-desc').forEach(el => el.style.color = '#858585');
            document.querySelectorAll('#setup-body label').forEach(el => el.style.color = '#cccccc');
            document.querySelectorAll('#setup-body .slider-value').forEach(el => el.style.color = '#667eea');
        }
    }
}
