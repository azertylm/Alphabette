import re

shell_path = "C:/Users/azert/Documents/Projet par défaut/public/la-barre-explication.html"
prompt_path = "C:/Users/azert/Downloads/prompt_magic_tech_for_good_studio.html"

shell = open(shell_path, encoding="utf-8").read()
prompt = open(prompt_path, encoding="utf-8").read()

# Extract shell CSS
css_start = shell.index("<style>")
css_end = shell.index("</style>") + len("</style>")
shell_css = shell[css_start:css_end]

# Extract shell body block: from immersion button comment to documentation interactive comment
body_marker_start = shell.index("<!-- BOUTON DE SECOURS MODE IMMERSION -->")
body_marker_end = shell.index("<!-- ============================ DOCUMENTATION INTERACTIVE")
shell_body = shell[body_marker_start:body_marker_end].rstrip()

# Extract shell script
script_start = shell.index("<script>")
script_end = shell.rindex("</script>") + len("</script>")
shell_script = shell[script_start:script_end]

# --- Edit shell config ---
# Replace currentApp block
old_current = '''  currentApp: {
    id: "infoperso",
    name: "Info Perso",
    subtitle: "Votre curation intelligente hautement personnalisée",
    icon: "📰",
    accent: "#2563eb", // Change cette couleur (ex: #10b981, #8b5cf6) : toute la barre s'adapte !
    menuLinks: [
      { label: "Tableau de bord", href: "#dashboard" },
      { label: "Mes flux & sources", href: "#sources" },
      { label: "Synthèse IA du jour", href: "#synthese" },
      { label: "Paramètres de curation", href: "#settings" }
    ]
  },'''
new_current = '''  currentApp: {
    id: "promptmagic",
    name: "Prompt Magic",
    subtitle: "Architecte de sites & apps utiles à l'humain",
    icon: "✨",
    accent: "#8b5cf6",
    menuLinks: [
      { label: "20 idées prêtes", href: "#section-ideas" },
      { label: "Explorateur 20 niveaux", href: "#section-explorer" },
      { label: "Studio & aperçu UI", href: "#section-studio" },
      { label: "Bibliothèque", href: "#section-studio" }
    ]
  },'''
assert old_current in shell_script, "currentApp block not found"
shell_script = shell_script.replace(old_current, new_current)

# Replace ecosystem sites block
old_sites = '''    sites: [
      { id: "proxilien", name: "Proxilien", icon: "📍", url: "https://proxilien.alphabette.fr", status: "online" },
      { id: "iadebat", name: "IA Débat", icon: "⚖️", url: "https://iadebat.alphabette.fr", status: "draft" },
      { id: "infoperso", name: "Info Perso", icon: "📰", url: "https://infoperso.alphabette.fr", status: "online" },
      { id: "oeilatelier", name: "Œil de l'Atelier", icon: "🔨", url: "https://oeil.alphabette.fr", status: "online" },
      { id: "lidarsol", name: "Lidarsol", icon: "🛰️", url: "https://lidarsol.alphabette.fr", status: "draft" }
    ]'''
new_sites = '''    sites: [
      { id: "promptmagic", name: "Prompt Magic", icon: "✨", url: "https://promptmagic.alphabette.fr", status: "online" },
      { id: "proxilien", name: "Proxilien", icon: "📍", url: "https://proxilien.alphabette.fr", status: "draft" },
      { id: "frigoplacard", name: "FrigoZéroGâchis", icon: "🥬", url: "https://frigoplacard.alphabette.fr", status: "draft" },
      { id: "infosperso", name: "Info Perso", icon: "📰", url: "https://infosperso.alphabette.fr", status: "online" },
      { id: "sante-citoyenne", name: "Santé Citoyenne", icon: "❤️", url: "https://sante-citoyenne.alphabette.fr", status: "draft" }
    ]'''
assert old_sites in shell_script, "sites block not found"
shell_script = shell_script.replace(old_sites, new_sites)

# Modify applyTheme to toggle .dark class and sync app theme icons
old_apply = '''  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('alphabette_theme', theme);
    const btn = document.getElementById('btn-theme');
    btn.textContent = theme === 'dark' ? '☀️ Jour' : '🌙 Nuit';
  },'''
new_apply = '''  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('alphabette_theme', theme);
    const btn = document.getElementById('btn-theme');
    if (btn) btn.textContent = theme === 'dark' ? '☀️ Jour' : '🌙 Nuit';
    const sun = document.getElementById('themeIconSun');
    const moon = document.getElementById('themeIconMoon');
    if (sun && moon) {
      const isDark = theme === 'dark';
      sun.classList.toggle('hidden', isDark);
      moon.classList.toggle('hidden', !isDark);
    }
  },'''
assert old_apply in shell_script
shell_script = shell_script.replace(old_apply, new_apply)

# Modify init savedTheme default to dark and ensure class
# Already fine.

# Now merge into prompt HTML
# 1. Insert shell CSS into head before </head> (after prompt's </style>)
prompt = prompt.replace("</head>", shell_css + "\n</head>", 1)

# 2. Insert shell body block right after <body ...> opening
# find body tag
import re
body_match = re.search(r"<body[^>]*>", prompt)
assert body_match
insert_pos = body_match.end()
prompt = prompt[:insert_pos] + "\n" + shell_body + "\n" + prompt[insert_pos:]

# 3. Make app header non-sticky
prompt = prompt.replace('<header class="sticky top-0 z-40 backdrop-blur-xl', '<header class="z-40 backdrop-blur-xl', 1)

# 4. Insert shell script before prompt's main script. Find the app script tag (the last <script>)
# prompt has 2 scripts: tailwind config in head, and main script before </body>. Insert shell script before main script.
# Find "<!-- APPLICATION LOGIC -->"
marker = "<!-- APPLICATION LOGIC -->"
assert marker in prompt
prompt = prompt.replace(marker, shell_script + "\n\n" + marker, 1)

# 5. Modify app theme toggle handler to delegate to Shell
old_toggle = """      $('#btnThemeToggle').onclick = () => {
        const html = document.documentElement;
        html.classList.toggle('dark');
        const isDark = html.classList.contains('dark');
        $('#themeIconSun').classList.toggle('hidden', isDark);
        $('#themeIconMoon').classList.toggle('hidden', !isDark);
        showToast(isDark ? 'Thème Sombre Néo-Glass activé' : 'Thème Clair Solaire activé', 'info');
      };"""
new_toggle = """      $('#btnThemeToggle').onclick = () => Shell.toggleTheme();"""
assert old_toggle in prompt
prompt = prompt.replace(old_toggle, new_toggle)

# 6. Make sure initial html has dark class? shell init handles. But prompt's initial <html class="dark">. Keep.

# Write output
out_path = "C:/Users/azert/Documents/Projet par défaut/prompt_magic_integre_barre.html"
open(out_path, "w", encoding="utf-8").write(prompt)
print("written", out_path, len(prompt))
