/**
  * Ref:
 *  pxt-common-packages\libs\mixer\instrument.ts, sequencer.ts, melody.ts, playable.ts
 * 
* TODO: 
 *  ppt adjust by lyricWordsSeparator?
 * 
 */
namespace Karaoke {
    const font12Double = image.doubledFont(image.font12)
    const font8Double = image.doubledFont(image.font8)
    const bg = game.currentScene().background.image

    let _song:music.sequencer.Song
    let _title=""
    let titleFont = font12Double
    let _lyric: string[]
    let _lyricWordsSeparator = ""
    let _lyricSentencesSeparator = ""
    let sentencesTicks: number[] = undefined  //start ticks of each sentences
    let sentencesByLyric: number[] = undefined  //start index of each sentences


    const noteNumberNames = ["1", "1#", "2", "2#", "3", "4", "4#", "5", "5#", "6", "6#", "7"]
    let seq: music.sequencer.Sequencer
    let lastMsShowScore = 0

    function clearVariables() {
        sentencesTicks = undefined
        picthOffset = 0
        lastMsShowScore = 0
    }

    export function showAsScore(v:number){
        info.showScore(true)
        info.setScore(v)
        lastMsShowScore = control.millis() //auto show off later
    }

    function setTitle(s: string) {
        if (s) _title = s
    }

    export function setLyricWordsSeparator(s: string) {
        if (!s) s=""
        _lyricWordsSeparator = s
        titleFont = (s.length > 0) ? font8Double:font12Double
    }

    export function setLyricSentencesSeparator(s: string) {
        if (!s) s = ""
        _lyricSentencesSeparator = s
    }

    function setLyric(lyric: string = null){
        ppt=5
        if (!lyric)
            _lyric = []
        else if (_lyricWordsSeparator && _lyricWordsSeparator.length>0) {
            ppt=8
            _lyric = lyric.replaceAll("-", "-" + _lyricWordsSeparator).split(_lyricWordsSeparator)
            let r=true
            while (r){
                r=_lyric.removeElement("")
            }
        } else
            _lyric = lyric.replaceAll(" ", "").split("")

    }

    function creatEmptyMeasure(song: music.sequencer.Song){
        const buf=song.buf.slice(0,7)
        buf[5]=1 //1 measure
        buf[6]=0 //0 track
        return music.createSong(buf) as music.sequencer.Song
    }

    function setSong(song: music.sequencer.Song){
        if (!song) return

        if (seq) {
            seq.stop()
            seq = undefined
        }

        clearVariables()

        ticksPerBeat = song.ticksPerBeat
        tickPerMeasure = song.beatsPerMeasure * ticksPerBeat
        let emptyMeasure = creatEmptyMeasure(song)
        _song = SongEditor.append(emptyMeasure, song)
        _song = SongEditor.append(_song, emptyMeasure)
        info.setLife(song.beatsPerMinute)

        //only notes of first melody track
        _notesTrack = _song.tracks.find((t) => t.isMelodicTrack)
        ajustYOffset()
    }

    function scanSentecesInMelody() {
        if (!sentencesTicks)
            sentencesTicks = [0]
        let lastStartTick = 0, lastEndTick = 0
        const tempNote = new music.sequencer.NoteEvent(_notesTrack.buf, _notesTrack.noteEventStart + 2)
        for (; tempNote.offset < _notesTrack.offset + _notesTrack.byteLength; tempNote.offset += tempNote.byteLength) {
            if (tempNote.startTick >= lastEndTick + _song.ticksPerBeat / 2) {
                lastStartTick = tempNote.startTick
                sentencesTicks.push(tempNote.startTick)
            }
            lastEndTick = tempNote.endTick
        }
    }

    function scanSentencesInLyric(){
        if (_lyricSentencesSeparator && _lyricSentencesSeparator.length > 0) {
            sentencesByLyric = []
            let iLast=-1
            while (1) {
                const i = _lyric.indexOf(_lyricSentencesSeparator)
                if (i === -1) 
                    break
                if (i != iLast){
                    sentencesByLyric.push(i)
                    iLast=i
                }
                _lyric.removeElement(_lyricSentencesSeparator)
            }
            if (sentencesByLyric.length <= 1)
                sentencesByLyric = undefined
        } else
            sentencesByLyric = undefined
    }

    function translateSentencesInLyricToTicks(){
        if (!_notesTrack || !sentencesByLyric || sentencesByLyric.length <= 1) return

        if (sentencesByLyric[0]!=0)
            sentencesByLyric.insertAt(0, 0)
        sentencesTicks=[0]
        let iSentence = 0, iNote = 0
        const tempNote = new music.sequencer.NoteEvent(_notesTrack.buf, _notesTrack.noteEventStart + 2)
        for (; tempNote.offset < _notesTrack.offset + _notesTrack.byteLength; tempNote.offset += tempNote.byteLength) {
            if (iNote==sentencesByLyric[iSentence]){
                sentencesTicks.push(tempNote.startTick)
                iSentence++
                if(iSentence>=sentencesByLyric.length)
                    break
            }
            iNote++
        }
    }

    function clearSong(){
        seq.stop()
        seq=undefined
        _song=undefined
        _notesTrack=undefined
    }

    export function playSong(song: music.sequencer.Song, title?:string, lyric:string=null, notesTrack:number=null){
        _title = title? title :""
        setSong(song)
        if (0 < notesTrack && notesTrack < _song.tracks.length){
            _notesTrack = _song.tracks[notesTrack]
            ajustYOffset()
        }
        setLyric(lyric)

        scanSentencesInLyric()
        translateSentencesInLyricToTicks()

        if(sentencesByLyric)
        // console.log(sentencesByLyric.join())

        play(true)
    }

    let tick = 0
    export function changeBPM(delta: number, restart = false) {
        if (_song){
            delta |= 0
            if (_song.beatsPerMinute + delta > 0)
                _song.beatsPerMinute+=delta
            // play(restart)
            info.setLife(_song.beatsPerMinute)
        }
    }

    let picthOffset=0
    export function changePitch(delta:number){
        delta |= 0
        // const playing= isPlaying()
        if (_song) {
            const iNotesTrack= _song.tracks.indexOf(_notesTrack)
            _song=SongEditor.riseFallTone(_song, delta)
            picthOffset+=delta
            picthOffset%=0x40 // notes&0x3F by note.getNote()
            showAsScore(picthOffset)
            ajustYOffset()
            forceRedraw()

            if(seq){
                seq.song=_song
                fixCurrentNote(seq.currentTick)
                _notesTrack = (iNotesTrack >= 0) ?
                    _song.tracks[iNotesTrack] :
                    _notesTrack = _song.tracks.find((t) => t.isMelodicTrack)
            }
        }
    }

    function ajustYOffset(){
        let maxPitch = 30, minPitch = 30
        const tempNote = new music.sequencer.NoteEvent(_notesTrack.buf, _notesTrack.noteEventStart + 2)
        for (; tempNote.offset < _notesTrack.offset + _notesTrack.byteLength; tempNote.offset += tempNote.byteLength) {
            for (let i = 0; i < tempNote.polyphony; i++) {
                maxPitch = Math.max(maxPitch, tempNote.getNote(i))
                minPitch = Math.min(minPitch, tempNote.getNote(i))
            }
        }
        yOffset = 60+((maxPitch + minPitch) / 2)*noteHeight +10
    }

    let _notesTrack:music.sequencer.Track
    function play(restart = false) {
        if(!_song) return
        let lastTick = -1
        if (seq) {
            if (!restart)
                lastTick = seq.currentTick
        } else
            seq = new music.sequencer.Sequencer(_song)

        seq.start(true)

        if (lastTick) {
            seq.currentTick = lastTick
            fixCurrentNote(seq.currentTick)
        }
    }

    export function fixCurrentNote(startTick:number) {
        for (let track of seq.song.tracks) {
            track.currentNoteEvent.offset = track.noteEventStart + 2
            while (track.currentNoteEvent.startTick < startTick ) {
                // track.advanceNoteEvent() //not work, will die loop to begin at end
                track.currentNoteEvent.offset += track.currentNoteEvent.byteLength;
                if (track.currentNoteEvent.offset >= track.offset + track.byteLength){
                    track.currentNoteEvent.offset = track.noteEventStart + 2
                    break
                }
            }
        }
    }

    let countingDown=false
    function countdown(canvas: Image){
        let countdown = 1 + ((_notesTrack.currentNoteEvent.startTick - 1 - tick) / _song.ticksPerBeat) 
        
        if((countdown|0)==0)
            countingDown=false
        else if (countdown <4&&(countdown%1)>.5)
                canvas.printCenter((countdown|0).toString(), 60, 5, font12Double)
    }


    let lastTick = -2
    game.onUpdate(() => {
        if (!seq||!seq.isPlaying)
            return
        let curTick = seq.currentTick

        //test 7/8 beats
        // if (curTick%32==28){
        //     curTick+=4
        //     jumpTick(curTick)
        // }

        if (curTick >= 0 && curTick != lastTick) {
            lastTick = curTick
            tick = curTick-1
        } else
            tick += _song.beatsPerMinute * _song.ticksPerBeat / 60 * game.eventContext().deltaTimeMillis / 1000

        if (tick<1)
            countingDown = true
        
        //auto show off
        if(lastMsShowScore&& control.millis()>lastMsShowScore+1500){
            lastMsShowScore=0
            info.showScore(false)
        }

    })

    //style
    const colorPitchC = 14
    const colorBeat1 = 11, colorBeat3 = 12, colorHalfBeat = 10

    //formats
    const padding = 33
    export let ppt = 8 // pixels per tick, be set after setSong/playSong
    const noteHeight = 3
    let yOffset = 120+20
    let ticksPerBeat=0
    let tickPerMeasure=0

    export function setYOffset(value:number){
        yOffset=value
        forceRedraw()
    }

    export function getYOffset(){
        return yOffset
    }

    let lastBeatX:number
    export function forceRedraw() {
        lastBeatX = undefined
    }

    export function drawChart(canvas:Image=null) {
        if(!_song) return
        let beatX = padding - ((tick % tickPerMeasure + tickPerMeasure) * ppt)
        if (lastBeatX == beatX)
            return
        lastBeatX = beatX

        if(!canvas) canvas=bg
        canvas.fill(0)

        //beats range
        const stepBeatLine = ticksPerBeat * ppt / 2
        const widthBeat = ticksPerBeat * ppt
        for (let beat = 0; beatX < canvas.width; beat+=0.5, beat %=_song.beatsPerMeasure) {
            if (beat == 0)
                canvas.fillRect(beatX, 0, widthBeat, canvas.height, colorBeat1)
            else if (beat == 2 || beat == 4)
                canvas.fillRect(beatX, 0, widthBeat, canvas.height, colorBeat3)
            canvas.drawLine(beatX, 0, beatX, canvas.height, colorHalfBeat)
            beatX += stepBeatLine

            if (stepBeatLine <= 16){ //skip halfBeat if notes too narrow
                beat += 0.5
                beatX += stepBeatLine
            }
        }

        //octave line
        let yPitch= getYByPitch(-12)
        const step= yPitch-getYByPitch(0)
        yPitch = (yPitch % step)+ noteHeight / 2
        for (; yPitch<canvas.height; yPitch+=step)
            canvas.drawLine(0, yPitch, canvas.width, yPitch, colorPitchC)

        canvas.drawLine(padding-1, 0, padding-1, canvas.height, 4)

        //notes
        if (_notesTrack) {
            const tempNote = new music.sequencer.NoteEvent(_notesTrack.buf, _notesTrack.noteEventStart + 2)
            let i = 0
            const tickScreenLeft = (tick - padding / ppt) | 0
            for (; tempNote.offset < _notesTrack.offset + _notesTrack.byteLength; tempNote.offset += tempNote.byteLength, i++) {
                if(tempNote.endTick < tickScreenLeft)
                    continue
                let xNoteLeft = padding + ((tempNote.startTick - tick) * ppt)
                if (xNoteLeft > canvas.width)
                    break
                const noteWidth = (tempNote.endTick - tempNote.startTick) * ppt

                // workaround of |0 bug in pack()
                if (xNoteLeft < 0)
                    xNoteLeft -= 1

                const noteIsActive = (tempNote.startTick <= tick && tick <= tempNote.endTick)
                let minY = 999
                for (let j = 0; j < tempNote.polyphony; j++) {
                    const picth = tempNote.getNote(j) - 1
                    const y = getYByPitch(picth)
                    if (y < minY) minY = y
                    canvas.fillRect(xNoteLeft, y, noteWidth, noteHeight, noteIsActive ? 5 : 3)

                    //note name
                    canvas.print(noteNumberNames[(picth + 12) % 12], xNoteLeft, y + 3)
                }
                if (i < _lyric.length)
                    canvas.print(_lyric[i], xNoteLeft + 1, minY - 12)
            }
        }

        if (countingDown) {
            // if(_title.length<)
            canvas.print("<" + _title + ">", padding + ((- tick) * ppt), 34, 3, titleFont)
            countdown(canvas)
        }
    }

    export function shiftSentence(delta: number) {
        delta |=0
        if(delta>0) delta--
        if(!_notesTrack) return

        if (!sentencesTicks)
            scanSentecesInMelody()

        const prefixTicks = (1 * (_song.beatsPerMinute * _song.ticksPerBeat / 60)) | 0
        const compareTick = tick + (delta >= 0 ? prefixTicks : 0)
        let index = 0
        for (; index < sentencesTicks.length; index++)
            if (sentencesTicks[index] > compareTick)
                break
        index += delta
        // if (index >= sentencesTicks.length)
        //     return
        index = Math.clamp(0, sentencesTicks.length - 1, index)
        jumpTick(sentencesTicks[index] - prefixTicks)
        fixCurrentNote(sentencesTicks[index])
    }

    export function fastForward(delta: number) {
        jumpTick(tick+delta*32)
    }

    export function jumpTick(v: number) {
        seq.currentTick = v
        if (seq.currentTick < 0)
            seq.currentTick = 0
        tick = seq.currentTick
        fixCurrentNote(seq.currentTick)

        forceRedraw()
    }

    export function getYByPitch(picth: number) {
        return - picth * noteHeight + yOffset
    }

    export function changeNoteWidth(delta:number) {
        ppt = Math.clamp(1, 100, ppt + delta/2)
        showAsScore(Karaoke.ppt)
    }


    export function isPlaying(){
        return seq && seq.isPlaying
    }

    export function stop(){
        if(seq)
            seq.stop()
    }

    export function resume(){
        play(false)
    }

    export function restart(){
        play(true)
    }

            
    export function Kana2Roma(str: string) { //https://en.wikipedia.org/wiki/Kana
        const vowel = ["a","i","u","e","o",""]
        const consonant =["","k","s","t","n","h","m","y","r","w","g","z","d","b","p"]
        const kana=[
            ["あ","い","う","え","お",],
            ["か","き","く","け","こ",],
            ["さ","し","す","せ","そ",],
            ["た","ち","つ","て","と",],
            ["な","に","ぬ","ね","の","ん"],
            ["は","ひ","ふ","へ","ほ",],
            ["ま","み","む","め","も",],
            ["や","","ゆ","","よ",],
            ["ら","り","る","れ","ろ",],
            ["わ", "", "", "", "を",],
            ["が","ぎ","ぐ","げ","ご"],
            ["ざ","じ","ず","ぜ","ぞ"],
            ["だ","ぢ","づ","で","ど"],
            ["ば","び","ぶ","べ","ぼ"],
            ["ぱ","ぴ","ぷ","ぺ","ぽ"],

            ["ア","イ","ウ","エ","オ"],
            ["カ","キ","ク","ケ","コ"],
            ["サ","シ","ス","セ","ソ"],
            ["タ","チ","ツ","テ","ト"],
            ["ナ","ニ","ヌ","ネ","ノ","ン"],
            ["ハ","ヒ","フ","ヘ","ホ"],
            ["マ","ミ","ム","メ","モ"],
            ["ヤ","イ","ユ","エ","ヨ"],
            ["ラ","リ","ル","レ","ロ"],
            ["ワ","イ","ウ","エ","ヲ"],
            ["ガ","ギ","グ","ゲ","ゴ"],
            ["ザ","ジ","ズ","ゼ","ゾ"],
            ["ダ","デ","ド","デ","ド"],
            ["バ","ビ","ブ","べ","ボ"],
            ["パ","ピ","プ","ペ","ポ"],
        ]
        function Kana2Roma_char(c:string) {
            for (let row = 0; row < kana.length;row++)
                for (let col = 0; col < kana[row].length; col++){
                    if (c==kana[row][col]) 
                        return consonant[row%consonant.length]+vowel[col]+" "
                }
            if(c=="っ") return "- "
            return c+" "
        }

        let newStr = ""
        for (let c of str)
            newStr+=Kana2Roma_char(c)

        return newStr
    }
}
