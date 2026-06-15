import os, random
OUT=os.path.dirname(os.path.abspath(__file__))
COBALT="#2563EB";COBALT_D="#1d4ed8";COBALT_L="#3b82f6"
VIOLET="#5A0FC8";GREEN="#3DDC84";MID="#0B1020";MID2="#121a33"
PAPER="#F4F6FF";DIM="#26304f"
FONT="Poppins, Nunito, 'Segoe UI', system-ui, sans-serif"
MONO="'JetBrains Mono','Space Mono',ui-monospace,monospace"
def defs():
    return f'''<defs>
  <radialGradient id="bg" cx="50%" cy="38%" r="80%"><stop offset="0%" stop-color="{MID2}"/><stop offset="100%" stop-color="{MID}"/></radialGradient>
  <linearGradient id="cob" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="{COBALT_L}"/><stop offset="100%" stop-color="{COBALT_D}"/></linearGradient>
  <filter id="glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="gglow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="9"/></filter>
</defs>'''
def hdr(w,h): return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">'
def bg(w,h): return f'<rect width="{w}" height="{h}" fill="url(#bg)"/>'
def particles(w,h,n,seed):
    random.seed(seed);o=[]
    for _ in range(n):
        x=random.uniform(0,w);y=random.uniform(0,h);s=random.choice([2,3,4,5,6]);op=random.uniform(0.05,0.28)
        c=random.choice([COBALT,COBALT_L,VIOLET,GREEN])
        o.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{s}" height="{s}" rx="1" fill="{c}" opacity="{op:.2f}"/>')
    return "\n".join(o)
def chameleon(cx,cy,scale=1.0,eye_to="right"):
    g=[f'<g transform="translate({cx},{cy}) scale({scale})">']
    g.append(f'<path d="M -150,30 C -230,30 -250,-70 -180,-90 C -120,-105 -120,-30 -160,-25 C -185,-22 -185,-55 -165,-58" fill="none" stroke="url(#cob)" stroke-width="34" stroke-linecap="round"/>')
    random.seed(3)
    for i in range(16):
        bx=-250-random.uniform(0,70);by=-90+random.uniform(-60,60);s=random.choice([6,8,10,12]);o=max(0.15,0.9-i*0.05)
        g.append(f'<rect x="{bx:.0f}" y="{by:.0f}" width="{s}" height="{s}" rx="2" fill="{COBALT_L}" opacity="{o:.2f}"/>')
    g.append(f'<path d="M -40,95 q -18,55 -55,70" fill="none" stroke="{COBALT_D}" stroke-width="26" stroke-linecap="round"/>')
    g.append(f'<path d="M 70,95 q 18,55 55,70" fill="none" stroke="{COBALT_D}" stroke-width="26" stroke-linecap="round"/>')
    g.append(f'<path d="M -160,10 C -150,-90 -60,-150 30,-150 C 130,-150 195,-95 205,-30 C 212,15 175,70 150,95 C 90,150 -70,150 -120,110 C -160,80 -168,55 -160,10 Z" fill="url(#cob)"/>')
    g.append(f'<path d="M -120,75 C -60,140 90,140 145,90 C 110,120 -70,128 -120,75 Z" fill="{COBALT_L}" opacity="0.55"/>')
    for i,t in enumerate([-120,-80,-38,5,50,95]):
        hh=22-abs(i-2)*2
        g.append(f'<path d="M {t},{-150+abs(i-2)*6} l 14,-{hh} l 14,{hh} Z" fill="{VIOLET}" opacity="0.9"/>')
    g.append(f'<path d="M 150,-70 C 215,-80 270,-45 270,5 C 270,55 215,80 165,70 C 120,60 120,-55 150,-70 Z" fill="url(#cob)"/>')
    g.append(f'<ellipse cx="262" cy="22" rx="48" ry="34" fill="{COBALT_D}"/>')
    g.append(f'<path d="M 225,38 q 45,28 80,6" fill="none" stroke="{MID}" stroke-width="6" stroke-linecap="round"/>')
    g.append(f'<circle cx="205" cy="-28" r="52" fill="url(#cob)"/>')
    g.append(f'<circle cx="205" cy="-28" r="36" fill="{PAPER}"/>')
    ix=218 if eye_to=="right" else 192
    g.append(f'<circle cx="{ix}" cy="-24" r="18" fill="{GREEN}"/>')
    g.append(f'<circle cx="{ix}" cy="-24" r="8" fill="{MID}"/>')
    g.append(f'<circle cx="{ix-6}" cy="-30" r="5" fill="{PAPER}"/>')
    random.seed(11)
    for _ in range(46):
        px=random.uniform(-150,240);py=random.uniform(-140,120)
        if py>60 and px<-90: continue
        s=random.choice([10,12,14]);o=random.uniform(0.05,0.18)
        g.append(f'<rect x="{px:.0f}" y="{py:.0f}" width="{s}" height="{s}" rx="2" fill="{PAPER}" opacity="{o:.2f}"/>')
    g.append(f'<g filter="url(#glow)"><rect x="-40" y="20" width="46" height="46" rx="8" fill="{GREEN}" opacity="0.95"/><circle cx="-17" cy="40" r="7" fill="{MID}"/><rect x="-20" y="40" width="6" height="14" fill="{MID}"/></g>')
    g.append('</g>');return "\n".join(g)
def w(name,parts):
    open(os.path.join(OUT,name),"w").write("\n".join(parts)+"\n</svg>")
def mascot():
    s=[hdr(800,800),defs(),bg(800,800),particles(800,800,60,5)]
    s.append(f'<rect x="80" y="600" width="640" height="34" rx="17" fill="{VIOLET}" opacity="0.55"/>')
    s.append(chameleon(400,470,1.25))
    s.append(f'<text x="400" y="710" font-family="{FONT}" font-size="46" font-weight="800" fill="{PAPER}" text-anchor="middle">Steg</text>')
    s.append(f'<text x="400" y="748" font-family="{FONT}" font-size="22" fill="{COBALT_L}" text-anchor="middle" letter-spacing="3">HIDES IN PLAIN SIGHT</text>')
    w("steg-mascot.svg",s)
def title():
    s=[hdr(1080,1080),defs(),bg(1080,1080),particles(1080,1080,110,8)]
    s.append(f'<circle cx="540" cy="600" r="320" fill="{COBALT}" opacity="0.10" filter="url(#gglow)"/>')
    s.append(chameleon(560,620,1.05))
    s.append(f'<g filter="url(#glow)"><circle cx="350" cy="690" r="70" fill="none" stroke="{GREEN}" stroke-width="12"/><line x1="398" y1="738" x2="470" y2="810" stroke="{GREEN}" stroke-width="18" stroke-linecap="round"/></g>')
    s.append(f'<text x="540" y="170" font-family="{FONT}" font-size="92" font-weight="900" fill="{PAPER}" text-anchor="middle">HIDDEN IN</text>')
    s.append(f'<text x="540" y="262" font-family="{FONT}" font-size="92" font-weight="900" fill="{GREEN}" text-anchor="middle" filter="url(#glow)">PLAIN SIGHT</text>')
    s.append(f'<text x="540" y="320" font-family="{FONT}" font-size="30" fill="{COBALT_L}" text-anchor="middle" letter-spacing="2">how secrets hide inside ordinary things</text>')
    s.append(f'<text x="540" y="980" font-family="{MONO}" font-size="26" fill="{PAPER}" text-anchor="middle" opacity="0.8">steganography, explained  -  Cipher</text>')
    w("title-card.svg",s)
def cvs():
    s=[hdr(1080,1350),defs(),bg(1080,1350),particles(1080,1350,80,12)]
    s.append(f'<text x="540" y="120" font-family="{FONT}" font-size="62" font-weight="900" fill="{PAPER}" text-anchor="middle">Two ways to keep a secret</text>')
    s.append(f'<line x1="540" y1="190" x2="540" y2="1180" stroke="{DIM}" stroke-width="3" stroke-dasharray="2 12"/>')
    s.append(f'<text x="270" y="270" font-family="{FONT}" font-size="40" font-weight="800" fill="{COBALT_L}" text-anchor="middle">CRYPTOGRAPHY</text>')
    s.append(f'<text x="270" y="312" font-family="{FONT}" font-size="24" fill="{PAPER}" text-anchor="middle" opacity="0.8">hides the meaning</text>')
    s.append(f'<g filter="url(#glow)"><rect x="160" y="470" width="220" height="170" rx="18" fill="{COBALT}"/><rect x="160" y="470" width="220" height="50" rx="18" fill="{COBALT_L}"/><circle cx="270" cy="560" r="26" fill="{MID}"/><rect x="262" y="560" width="16" height="40" fill="{MID}"/><path d="M 225,470 v-26 a45,45 0 0 1 90,0 v26" fill="none" stroke="{PAPER}" stroke-width="14"/></g>')
    s.append(f'<rect x="120" y="640" width="300" height="26" rx="8" fill="{DIM}"/>')
    random.seed(2)
    for i in range(7):
        ex=120+i*45;ey=740+(i%2)*30
        s.append(f'<g><ellipse cx="{ex}" cy="{ey}" rx="20" ry="13" fill="{PAPER}"/><circle cx="{ex}" cy="{ey}" r="7" fill="{MID}"/></g>')
    s.append(f'<text x="270" y="900" font-family="{FONT}" font-size="26" fill="{PAPER}" text-anchor="middle" opacity="0.85">everyone SEES the secret...</text>')
    s.append(f'<text x="270" y="940" font-family="{FONT}" font-size="26" fill="{PAPER}" text-anchor="middle" opacity="0.85">they just cannot open it</text>')
    s.append(f'<text x="810" y="270" font-family="{FONT}" font-size="40" font-weight="800" fill="{GREEN}" text-anchor="middle">STEGANOGRAPHY</text>')
    s.append(f'<text x="810" y="312" font-family="{FONT}" font-size="24" fill="{PAPER}" text-anchor="middle" opacity="0.8">hides the secret itself</text>')
    s.append(f'<path d="M 690,640 q -40,-150 120,-160 q 160,0 130,160 q 10,40 -60,46 q -150,16 -190,-46 Z" fill="{DIM}"/>')
    s.append(f'<g opacity="0.34">{chameleon(810,560,0.55)}</g>')
    s.append(f'<text x="810" y="900" font-family="{FONT}" font-size="26" fill="{PAPER}" text-anchor="middle" opacity="0.85">nobody even LOOKS...</text>')
    s.append(f'<text x="810" y="940" font-family="{FONT}" font-size="26" fill="{PAPER}" text-anchor="middle" opacity="0.85">it hides in plain sight</text>')
    s.append(f'<text x="540" y="1120" font-family="{FONT}" font-size="36" font-weight="800" fill="{PAPER}" text-anchor="middle">Cipher does <tspan fill="{GREEN}">both</tspan>.</text>')
    s.append(f'<text x="540" y="1170" font-family="{FONT}" font-size="26" fill="{COBALT_L}" text-anchor="middle">lock the meaning, then hide that there is a message at all</text>')
    w("crypto-vs-steg.svg",s)
def card_base(W,H,tag,ti,sub,accent=GREEN):
    s=[hdr(W,H),defs(),bg(W,H),particles(W,H,55,abs(hash(tag))%99)]
    s.append(f'<rect x="40" y="40" width="{W-80}" height="{H-80}" rx="34" fill="none" stroke="{DIM}" stroke-width="2"/>')
    s.append(f'<rect x="70" y="74" width="150" height="48" rx="24" fill="{accent}" opacity="0.16"/>')
    s.append(f'<text x="145" y="106" font-family="{MONO}" font-size="24" fill="{accent}" text-anchor="middle" font-weight="700">{tag}</text>')
    s.append(f'<text x="70" y="190" font-family="{FONT}" font-size="54" font-weight="900" fill="{PAPER}">{ti}</text>')
    s.append(f'<text x="70" y="232" font-family="{FONT}" font-size="26" fill="{COBALT_L}">{sub}</text>')
    return s
def text_card():
    s=card_base(880,1100,"TEXT","Invisible ink","of the internet")
    s.append(f'<g transform="translate(150,360)"><rect x="0" y="0" width="560" height="150" rx="34" fill="{MID2}" stroke="{DIM}" stroke-width="2"/><path d="M 60,150 l 0,46 l 46,-46 Z" fill="{MID2}"/><text x="40" y="92" font-family="{FONT}" font-size="40" fill="{PAPER}">hey what\'s up :)</text></g>')
    s.append('<g>'+''.join(f'<rect x="{198+i*52}" y="476" width="6" height="6" rx="1" fill="{GREEN}" opacity="0.5"/>' for i in range(8))+'</g>')
    s.append(f'<g filter="url(#glow)"><circle cx="650" cy="468" r="58" fill="{GREEN}" opacity="0.06"/><circle cx="650" cy="468" r="58" fill="none" stroke="{GREEN}" stroke-width="11"/><line x1="692" y1="510" x2="752" y2="570" stroke="{GREEN}" stroke-width="16" stroke-linecap="round"/></g>')
    s.append(f'<text x="70" y="632" font-family="{FONT}" font-size="24" fill="{PAPER}" opacity="0.6">decode the gaps   -></text>')
    s.append(f'<g filter="url(#glow)"><text x="330" y="636" font-family="{MONO}" font-size="42" fill="{GREEN}" letter-spacing="4">meet at 8</text></g>')
    s.append(f'<text x="70" y="760" font-family="{FONT}" font-size="30" fill="{PAPER}" opacity="0.9">Text can hold real characters that</text>')
    s.append(f'<text x="70" y="800" font-family="{FONT}" font-size="30" fill="{PAPER}" opacity="0.9">show up as <tspan fill="{GREEN}">nothing</tspan> - "zero-width"</text>')
    s.append(f'<text x="70" y="840" font-family="{FONT}" font-size="30" fill="{PAPER}" opacity="0.9">letters. A whole message fits</text>')
    s.append(f'<text x="70" y="880" font-family="{FONT}" font-size="30" fill="{PAPER}" opacity="0.9">in the spaces between words.</text>')
    s.append(f'<text x="70" y="975" font-family="{MONO}" font-size="22" fill="{COBALT_L}">this is Cipher\'s Steg mode</text>')
    w("metaphor-text.svg",s)
def image_card():
    s=card_base(880,1100,"IMAGE","Change the last digit","hide a whole letter")
    for i,x in enumerate([120,470]):
        lbl="original" if i==0 else "+ secret"
        s.append(f'<g transform="translate({x},330)"><rect width="290" height="220" rx="18" fill="{MID2}" stroke="{DIM}" stroke-width="2"/><circle cx="145" cy="95" r="55" fill="{COBALT}"/><path d="M 100,55 l 18,-30 l 16,30 Z" fill="{COBALT}"/><path d="M 190,55 l -18,-30 l -16,30 Z" fill="{COBALT}"/><circle cx="128" cy="92" r="8" fill="{PAPER}"/><circle cx="162" cy="92" r="8" fill="{PAPER}"/><path d="M 120,165 q 25,24 50,0" stroke="{PAPER}" stroke-width="4" fill="none"/><text x="145" y="205" font-family="{MONO}" font-size="18" fill="{PAPER}" text-anchor="middle" opacity="0.6">{lbl}</text></g>')
    s.append(f'<text x="440" y="600" font-family="{FONT}" font-size="26" fill="{PAPER}" text-anchor="middle" opacity="0.85">identical to your eyes</text>')
    s.append('<g transform="translate(150,640)">')
    vals=[["98","78","01"],["86","12","33"],["54","90","21"]]
    for r in range(3):
        for c in range(3):
            x=c*120;y=r*86;v=vals[r][c]
            s.append(f'<rect x="{x}" y="{y}" width="110" height="78" rx="8" fill="{MID2}" stroke="{DIM}" stroke-width="2"/>')
            s.append(f'<text x="{x+18}" y="{y+50}" font-family="{MONO}" font-size="34" fill="{PAPER}">{v[0]}3</text>')
            s.append(f'<text x="{x+74}" y="{y+50}" font-family="{MONO}" font-size="34" fill="{GREEN}" filter="url(#glow)">{1 if (r+c)%2 else 0}</text>')
    s.append('</g>')
    s.append(f'<text x="600" y="720" font-family="{FONT}" font-size="26" fill="{PAPER}" opacity="0.9">232-><tspan fill="{GREEN}">233</tspan></text>')
    s.append(f'<text x="600" y="756" font-family="{FONT}" font-size="22" fill="{PAPER}" opacity="0.7">the last bit</text>')
    s.append(f'<text x="600" y="784" font-family="{FONT}" font-size="22" fill="{PAPER}" opacity="0.7">= invisible</text>')
    s.append(f'<text x="70" y="1010" font-family="{FONT}" font-size="27" fill="{PAPER}" opacity="0.9">Millions of pixels -> hide pages of text.</text>')
    w("metaphor-image.svg",s)
def voice_card():
    s=card_base(880,1100,"VOICE","A face in the noise","hidden under the sound")
    random.seed(9);bars=[]
    for i in range(46):
        bx=90+i*16;bh=random.uniform(10,120)
        bars.append(f'<rect x="{bx}" y="{420-bh/2}" width="8" height="{bh}" rx="4" fill="{COBALT_L}" opacity="0.85"/>')
    s.append(f'<text x="90" y="360" font-family="{FONT}" font-size="26" fill="{PAPER}" opacity="0.8">play it -> just noise</text>')
    s.append("\n".join(bars))
    s.append(f'<text x="440" y="560" font-family="{FONT}" font-size="30" fill="{GREEN}" text-anchor="middle">now look ...</text>')
    s.append('<g transform="translate(150,600)"><rect width="580" height="320" rx="18" fill="'+MID2+'" stroke="'+DIM+'" stroke-width="2"/>')
    random.seed(4)
    for _ in range(260):
        x=random.uniform(10,570);y=random.uniform(10,310)
        s.append(f'<rect x="{x:.0f}" y="{y:.0f}" width="4" height="4" fill="{VIOLET}" opacity="{random.uniform(0.1,0.4):.2f}"/>')
    s.append(f'<g filter="url(#glow)" fill="none" stroke="{GREEN}" stroke-width="9"><circle cx="290" cy="160" r="95"/><circle cx="255" cy="135" r="4" fill="{GREEN}"/><circle cx="325" cy="135" r="4" fill="{GREEN}"/><path d="M 240,185 q 50,46 100,0"/></g>')
    s.append('</g>')
    s.append(f'<text x="440" y="985" font-family="{FONT}" font-size="27" fill="{PAPER}" text-anchor="middle" opacity="0.9">the soundwave x-ray reveals a hidden picture</text>')
    w("metaphor-voice.svg",s)
def file_card():
    s=card_base(880,1100,"FILE","The secret pocket","after THE END")
    s.append(f'<g transform="translate(150,330)"><rect width="320" height="400" rx="18" fill="{MID2}" stroke="{DIM}" stroke-width="2"/><rect x="0" y="0" width="320" height="70" rx="18" fill="{COBALT}"/><text x="22" y="46" font-family="{MONO}" font-size="26" fill="{PAPER}">meme.jpg</text><circle cx="160" cy="190" r="60" fill="{COBALT}"/><circle cx="138" cy="180" r="9" fill="{PAPER}"/><circle cx="182" cy="180" r="9" fill="{PAPER}"/><path d="M 130,215 q 30,28 60,0" stroke="{PAPER}" stroke-width="5" fill="none"/><text x="160" y="330" font-family="{MONO}" font-size="26" fill="{GREEN}" text-anchor="middle">- THE END -</text></g>')
    s.append(f'<g transform="translate(500,470)" filter="url(#glow)"><rect x="0" y="0" width="250" height="230" rx="14" fill="{MID2}" stroke="{GREEN}" stroke-width="3"/>')
    for i in range(3):
        s.append(f'<rect x="{24+i*14}" y="{30+i*10}" width="150" height="170" rx="8" fill="{GREEN}" opacity="{0.25+i*0.12:.2f}"/>')
    s.append(f'<rect x="150" y="150" width="70" height="62" rx="8" fill="{GREEN}"/><text x="185" y="190" font-family="{MONO}" font-size="22" fill="{MID}" text-anchor="middle">zip</text></g>')
    s.append(f'<text x="500" y="450" font-family="{FONT}" font-size="24" fill="{GREEN}">secret pages stapled after -></text>')
    s.append(f'<text x="70" y="830" font-family="{FONT}" font-size="30" fill="{PAPER}" opacity="0.9">Apps stop reading at "THE END."</text>')
    s.append(f'<text x="70" y="872" font-family="{FONT}" font-size="30" fill="{PAPER}" opacity="0.9">So a meme can secretly <tspan fill="{GREEN}">also be a folder.</tspan></text>')
    w("metaphor-file.svg",s)
def clogo(cx,cy,scale=1.0):
    g=[f'<g transform="translate({cx},{cy}) scale({scale})" fill="{COBALT}">']
    g.append('<path d="M -40,-80 L 10,-130 L 70,-130 L 70,-70 L 30,-70 L 6,-46 L 6,46 L 30,70 L 70,70 L 70,130 L 10,130 L -40,80 Z"/>')
    random.seed(1)
    for col in range(8):
        for _ in range(7-col):
            x=70+col*22+random.uniform(0,14);y=random.uniform(-120,120);s=max(3,14-col*1.3);o=max(0.12,0.9-col*0.11)
            g.append(f'<rect x="{x:.0f}" y="{y:.0f}" width="{s:.0f}" height="{s:.0f}" rx="2" opacity="{o:.2f}"/>')
    g.append('</g>');return "\n".join(g)
def endcard():
    s=[hdr(1080,1080),defs(),bg(1080,1080),particles(1080,1080,90,21)]
    s.append(f'<circle cx="540" cy="380" r="260" fill="{COBALT}" opacity="0.10" filter="url(#gglow)"/>')
    s.append(clogo(470,360,1.5))
    s.append(f'<text x="540" y="560" font-family="{FONT}" font-size="78" font-weight="900" fill="{PAPER}" text-anchor="middle">Cipher</text>')
    s.append(f'<text x="540" y="624" font-family="{FONT}" font-size="34" fill="{GREEN}" text-anchor="middle" filter="url(#glow)">Lock it. Then hide it.</text>')
    s.append(chameleon(430,800,0.7))
    s.append(f'<g transform="translate(620,760)"><rect width="300" height="96" rx="28" fill="{MID2}" stroke="{DIM}" stroke-width="2"/><text x="28" y="58" font-family="{FONT}" font-size="30" fill="{PAPER}" opacity="0.4">...looks empty</text></g>')
    s.append(f'<g filter="url(#glow)" transform="translate(600,720)"><rect x="0" y="0" width="54" height="44" rx="8" fill="{GREEN}"/><path d="M 10,0 v-14 a17,17 0 0 1 34,0 v14" fill="none" stroke="{GREEN}" stroke-width="9"/><circle cx="27" cy="22" r="6" fill="{MID}"/></g>')
    s.append(f'<text x="540" y="1010" font-family="{MONO}" font-size="26" fill="{COBALT_L}" text-anchor="middle">offline - on-device - open source</text>')
    w("cipher-endcard.svg",s)
mascot();title();cvs();text_card();image_card();voice_card();file_card();endcard()
print("generated", len(os.listdir(OUT)), "svgs")
