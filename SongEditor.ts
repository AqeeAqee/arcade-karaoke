/**
 * TODO:
 *  clone or makeWritable ?
 */

namespace SongEditor{
    
    //helper class with SongEditor features, make them can be called followed by another
    export class Builder{
        constructor(public song: music.sequencer.Song) {}

        public append(song2: music.sequencer.Song, stitch = false) {
            this.song = SongEditor.append(this.song, song2, stitch)
            return this
        }

        public printBuf(){
            SongEditor.printBuf(this.song)
            return this
        }

        public printTree(maxNotes?:number) {
            SongEditor.printTree(this.song, maxNotes)
            return this
        }


        public clone() {
            return new Builder(SongEditor.clone(this.song))
        }

        public reduceBeats(halfBeats: number) {
            this.song = SongEditor.reduceBeats(this.song, halfBeats)
            return this
        }

        public riseFallTone(picthOffsetByHalfTone: number) {
            this.song = SongEditor.riseFallTone(this.song, picthOffsetByHalfTone)
            return this
        }

        public addHarmony(picthOffsetByHalfTone: number) {
            this.song = SongEditor.addHarmony(this.song, picthOffsetByHalfTone)
            return this
        }

        public addInstrumentHarmony(toTrackIDs: number[], fromTrackID?: number) {
            this.song = SongEditor.addInstrumentHarmony(this.song, toTrackIDs, fromTrackID)
            return this
        }

        public replaceInstrument(toTrackID: number, fromTrackID?: number) {
            this.song = SongEditor.replaceInstrument(this.song, toTrackID, fromTrackID)
            return this
        }

        public moveNotesInSong(tickOffset: number) {
            this.song = SongEditor.moveNotesInSong(this.song, tickOffset)
            return this
        }

        public merge(song2: music.sequencer.Song) {
            this.song = SongEditor.merge(this.song, song2)
            return this
        }

        public addTracks(tracks: music.sequencer.Track[]) {
            this.song = SongEditor.addTracks(this.song, tracks)
            return this
        }

        public repeat(count: number, stitch = false) {
            this.song = SongEditor.repeat(this.song, count, stitch)
            return this
        }

        public fill(newTrack: boolean, withsong: music.sequencer.Song, stitch = false) {
            this.song = SongEditor.fill(this.song, newTrack, withsong, stitch)
            return this
        }
    }

    export function printBuf(song: music.sequencer.Song): string {
        const s = song.buf.toHex()
        console.log("music.createSong(hex`" + s + "`) as music.sequencer.Song")
        return s
    }

    export function clone(song: music.sequencer.Song){
        return new music.sequencer.Song(song.buf.slice())
    }

    function makeWritable(song: music.sequencer.Song){
        if (song.buf.isReadOnly())
            return new music.sequencer.Song(song.buf.slice())
        return song
    }

    function getTrackBuf(track: music.sequencer.Track): Buffer {
        return track.buf.slice(track.offset, track.byteLength)
    }

    function writeBuffer(dstBuffer: Buffer, dstOffset: number, srcBuffer: Buffer, srcOffset: number, srcLength: number) {
        for (let i = 0; i < srcLength; i++) {
            dstBuffer[dstOffset + i] = srcBuffer[srcOffset + i]
        }
    }

    function noteToString(note: music.sequencer.NoteEvent) {
        return [note.startTick, note.endTick, note.polyphony, note.getNote(0)].join()
    }

    export function printTree(song: music.sequencer.Song, maxNotes: number, prefix?:string) {
        if (!prefix)
            prefix = "__"
        console.logValue(prefix +"Header: ", song.buf.slice(0, 7).toHex())
        console.logValue(prefix + "Bytes: ", song.buf.length)

        prefix += "__"
        song.tracks.forEach((t) => {
            printTrackTree(t, maxNotes, prefix)
        })
    }

    export function printTrackTree(track: music.sequencer.Track, maxNotes: number, prefix?: string){
        if (!prefix)
            prefix = "__"
        console.logValue(prefix + "ID: ", track.id)
        console.logValue(prefix+"byteLength: ", track.byteLength + "( " + track.instrumentByteLength + " + " + track.noteEventByteLength+" )")

        let counter=0
        if(!maxNotes)maxNotes = 999999
        const prefixNotes = prefix+ "__"
        const lastNoteEnd = track.noteEventStart + 2 + track.noteEventByteLength
        let note = new music.sequencer.NoteEvent(track.buf, track.noteEventStart + 2)
        let lastOffset= note.offset
        for (;note.offset < lastNoteEnd; counter++,note.offset += note.byteLength) {
            if(counter<maxNotes)
                console.logValue(prefixNotes+"note:", noteToString(note))
            lastOffset=note.offset
        }
        if(counter>maxNotes)
            console.logValue(prefixNotes + " ...\n" + prefixNotes + "note:", noteToString(new music.sequencer.NoteEvent(track.buf, lastOffset)))

        console.logValue(prefix + "total notes: ", counter)
    }

    //release useless bytes between tracks
    function rewrite(song: music.sequencer.Song) {
        let totalBytes = 7
        song.tracks.forEach((t) => totalBytes += t.byteLength)
        const buf = Buffer.create(totalBytes)
        writeBuffer(buf, 0, song.buf, 0, 7)
        let offset = 7
        song.tracks.forEach((t) => {
            writeBuffer(buf, offset, t.buf, t.offset, t.byteLength)
            offset += t.byteLength
        })
        return new music.sequencer.Song(buf)
    }

    export function reduceBeats(song: music.sequencer.Song, halfBeats: number){
        halfBeats|=0
        if(halfBeats<3||halfBeats>7) return song
        song = clone(song)
        const ticksPerMeasure = song.beatsPerMeasure * song.ticksPerBeat
        const offsetTicksPerMeasure = (8 - halfBeats)*song.ticksPerBeat/2
        let latestNoteTick=0
        for (let track of song.tracks) {
            let note = new music.sequencer.NoteEvent(track.buf, track.noteEventStart + 2)
            while (note.offset < track.noteEventStart + 2 + track.noteEventByteLength) {
                const offset = Math.idiv(note.startTick, ticksPerMeasure) * offsetTicksPerMeasure
                note.startTick -= offset
                note.endTick -= offset
                latestNoteTick = Math.max(latestNoteTick, note.endTick)
                note.offset += note.byteLength
            }
        }
        song.measures= Math.idiv(latestNoteTick, halfBeats* song.ticksPerBeat/2)+1
        if(halfBeats%2==1){
            song.beatsPerMeasure=halfBeats
            song.ticksPerBeat=song.ticksPerBeat/2
        }else{
            song.beatsPerMeasure = halfBeats/2
            song.ticksPerBeat = song.ticksPerBeat
        }

        return song
    }

    export function riseFallTone(song: music.sequencer.Song, picthOffsetByHalfTone:number){
        picthOffsetByHalfTone |= 0
        song= clone(song)

        for(let track of song.tracks){
            if(!track.isMelodicTrack) continue
            let note = new music.sequencer.NoteEvent(track.buf, track.noteEventStart + 2)
            while (note.offset < track.noteEventStart + 2 + track.noteEventByteLength) {
                for(let i=0;i<note.polyphony;i++){
                    //TODO: picth<0
                    track.buf[note.offset+5+i] += picthOffsetByHalfTone
                    // set pitch=0 if negative, that can lost original note
                    // if (track.buf[note.offset + 5 + i] > 0xF0) track.buf[note.offset + 5 + i]=0
                }
                note.offset += note.byteLength
            }
        }

        return song
    }

    export function addInstrumentHarmony(song: music.sequencer.Song, toTrackIDs: number[], fromTrackID?: number) {
        const oldSong = clone(song)
        for (let toTrackID of toTrackIDs) {
            song= addTracks(song, replaceInstrument(oldSong, toTrackID, fromTrackID).tracks)
            // console.log([fromTrackID, toTrackID, song.tracks.length].join())
        }
        return song
    }

    export function addHarmony(song: music.sequencer.Song, picthOffsetByHalfTone: number) {
        return addTracks(song, riseFallTone(clone(song), picthOffsetByHalfTone).tracks)
    }

    //melody only
    export function replaceInstrument(song: music.sequencer.Song, toTrackID: number, fromTrackID?: number) {
        if (fromTrackID < 0 || fromTrackID > 8) return song
        if (toTrackID < 0 || toTrackID > 8) return song

        //Instrument bytes of Track 0~8, 1c length of each, and TrackID&Flag included
        const instrumentsBytes: Buffer = hex`\
        0000 1C00 010a006400f401640000040000000000000000000000000005000004\
        0100 1C00 0f05001202c102c20100040500280000006400280003140006020004\
        0200 1C00 0c960064006d019001000478002c010000640032000000000a060005\
        0300 1C00 01dc00690000045e0100040000000000000000000005640001040003\
        0400 1C00 100500640000041e000004000000000000000000000000000a040004\
        0500 1C00 0f0a006400f4010a0000040000000000000000000000000000000002\
        0600 1C00 010a006400f401640000040000000000000000000000000000000002\
        0700 1C00 020a006400f401640000040000000000000000000000000000000003\
        0800 1C00 0e050046006603320000040a002d0000006400140001320002010002`
        const instrumentByteLength = 2 + 2 + 0x1C // TrackID&Flag included
        let modified = false
        let buf = song.buf.slice()
        for (let track of song.tracks) {
            if (!track.isMelodicTrack) continue
            if (fromTrackID!=undefined && track.id != fromTrackID) continue

            // console.log([fromTrackID, toTrackID, track.id].join())
            buf.write(track.offset, instrumentsBytes.slice(toTrackID * instrumentByteLength, instrumentByteLength))
            const picthOffset = (track.buf[track.offset + 4 + 27] - buf[track.offset + 4 + 27]) * 12 //fromOctave - toOctave
            const lastNoteEnd = track.noteEventStart + 2 + track.noteEventByteLength
            for (let note = new music.sequencer.NoteEvent(track.buf, track.noteEventStart + 2); note.offset < lastNoteEnd; note.offset += note.byteLength) {
                for (let i = 0; i < note.polyphony; i++) 
                    buf[note.offset + 5 + i] += picthOffset
            }
            modified = true
        }

        if(modified)
            return new music.sequencer.Song(buf) //sub-objects renew required
        return song
    }

/*
    export function replaceInstrument_old(song: music.sequencer.Song, fromTrackID: number, toTrackID: number) {
        if (fromTrackID < 0 || fromTrackID > 8) return song
        if (toTrackID < 0 || toTrackID > 8) return song
        let index = -1
        const track = song.tracks.find((v, i) => {
            if (v.id == fromTrackID) {
                index = i; return true
            }
            else return false
        })
        if (!track) return song
        if (!track.isMelodicTrack) return song

        let buf = song.buf.slice()

        const instrumentByteLength = 2 + 2 + 0x1C // TrackID&Flag included
        //Instrument bytes of Track 0~8, 1c length of each, and TrackID&Flag included
        const instrumentsBytes: Buffer = hex`\
        0000 1C00 010a006400f401640000040000000000000000000000000005000004\
        0100 1C00 0f05001202c102c20100040500280000006400280003140006020004\
        0200 1C00 0c960064006d019001000478002c010000640032000000000a060005\
        0300 1C00 01dc00690000045e0100040000000000000000000005640001040003\
        0400 1C00 100500640000041e000004000000000000000000000000000a040004\
        0500 1C00 0f0a006400f4010a0000040000000000000000000000000000000002\
        0600 1C00 010a006400f401640000040000000000000000000000000000000002\
        0700 1C00 020a006400f401640000040000000000000000000000000000000003\
        0800 1C00 0e050046006603320000040a002d0000006400140001320002010002`
        buf.write(track.offset, instrumentsBytes.slice(toTrackID * instrumentByteLength, instrumentByteLength))

        const newSong = new music.sequencer.Song(buf)
        return newSong
    }
*/

    //source track modified
    //note before Tick 0 will be removed, if tickOffset<0
    function moveNotesInTrack(track: music.sequencer.Track, tickOffset: number) {
        let note = new music.sequencer.NoteEvent(track.buf, track.noteEventStart + 2)
        let writeOffset=note.offset
        while (note.offset < track.noteEventStart + 2+track.noteEventByteLength) {
            if (note.startTick + tickOffset >= 0) {//skip notes before tickOffset
                note.startTick += tickOffset
                note.endTick += tickOffset
                if (tickOffset<=0&&writeOffset!=note.offset){
                    writeBuffer(track.buf, writeOffset, note.buf, note.offset, note.byteLength)
                }
                writeOffset+=note.byteLength
            }
            note.offset += note.byteLength
        }
        track.buf.setNumber(NumberFormat.UInt16LE, track.noteEventStart, writeOffset - track.noteEventStart - 2 )
    }

    export function moveNotesInSong(song: music.sequencer.Song, tickOffset: number):music.sequencer.Song {
        tickOffset |= 0
        song = clone(song)

        song.tracks.forEach((track) => {
            moveNotesInTrack(track, tickOffset)
        })
        song.measures += ( tickOffset / song.ticksPerBeat / song.beatsPerMeasure)|0

        if(tickOffset<0)
            return(rewrite(song))

        return song
    }

    export function append(song: music.sequencer.Song, song2: music.sequencer.Song, stitch = false) {
        const measureOffset = song.measures - (stitch ? 1 : 0)
        const tickOffset = (measureOffset) * song.beatsPerMeasure * song.ticksPerBeat
        song2= moveNotesInSong(song2, tickOffset)
        let song3= merge(song, song2)
        return song3
    }

    function mergeTrack(track: music.sequencer.Track, track2: music.sequencer.Track): Buffer {
        let buf = Buffer.create(track.byteLength +2+track2.noteEventByteLength)
        const noteEventStart= track.noteEventStart - track.offset
        let offset = noteEventStart + 2
        buf.write(0, track.buf.slice(track.offset, offset)) //TrackID,Type,Instru Length(2Bytes)

        const note1 = new music.sequencer.NoteEvent(track.buf, track.noteEventStart + 2)
        const note2 = new music.sequencer.NoteEvent(track2.buf, track2.noteEventStart + 2)

        let valid1=true,valid2=true
        let curNote: music.sequencer.NoteEvent
        while(1){
            valid1 = note1.offset < track.offset + track.byteLength
            valid2 = note2.offset < track2.offset + track2.byteLength
            if (valid1&&valid2){
                if(note1.startTick == note2.startTick){
                    // console.log("Merge:" + noteToString(note1) + " " + noteToString(note2))
                    writeBuffer(buf, offset, note1.buf, note1.offset, note1.byteLength)
                    buf[offset+4]+=note2.polyphony //set new polyphony
                    offset += note1.byteLength
                    writeBuffer(buf, offset, note2.buf, note2.offset+5, note2.polyphony)
                    offset+=note2.polyphony
                    note1.offset += note1.byteLength
                    note2.offset += note2.byteLength
                    continue
                }
                else if (note1.startTick < note2.startTick) {
                    // console.log("note1:" + noteToString(note1))
                    curNote=note1
                }else{
                    // console.log("note2:" + noteToString(note2))
                    curNote=note2
                }
            } else if (valid1 && !valid2) {
                curNote = note1
            } else if (valid2 && !valid1) {
                curNote = note2
            }else
                break

            writeBuffer(buf, offset, curNote.buf, curNote.offset, curNote.byteLength)
            offset += curNote.byteLength
            curNote.offset += curNote.byteLength

        }

        buf.setNumber(NumberFormat.UInt16LE, noteEventStart, offset - noteEventStart - 2)
        return buf.slice(0, offset)
    }

    export function merge(song: music.sequencer.Song, song2: music.sequencer.Song) {
        let bufTracks = song.buf.slice(0, 7)

        let numberOfTracks=0
        for (let track of song.tracks) {
            const track2 = song2.tracks.find((v) => v.id == track.id)
            if (track2) {
                // console.log(track.id + " merge")
                numberOfTracks++
                const buf = mergeTrack(track, track2)
                bufTracks=bufTracks.concat(buf)
            } else {
                // console.log(track.id + " keep")
                numberOfTracks++
                bufTracks = bufTracks.concat(getTrackBuf(track))
            }
        }

        for (let track2 of song2.tracks) {
            if (!song.tracks.some((v) => v.id == track2.id)) {
                numberOfTracks++
                // console.log(track2.id + " add")
                bufTracks = bufTracks.concat(getTrackBuf(track2))
            }
        }

        bufTracks[6] = numberOfTracks  //should before init tracks
        const newSong = new music.sequencer.Song(bufTracks)
        newSong.measures=song2.measures
        return newSong
    }

    export function addTracks(song: music.sequencer.Song, tracks: music.sequencer.Track[]){
        let buf=song.buf
        let addedTracks=0
        for(let track2 of tracks){
            // if(song.tracks.some((v)=> v.id==track2.id))
            //     continue
            buf=buf.concat(track2.buf.slice(track2.offset, track2.byteLength))
            addedTracks++
        }
        buf[6] = song.numberOfTracks + addedTracks
        return new music.sequencer.Song(buf)
    }

    export function repeat(song: music.sequencer.Song, count: number, stitch=false): music.sequencer.Song{
        let buf=Buffer.create(0)

        let concatStart=0
        let tickOffset = (song.measures- (stitch?1:0)) * song.beatsPerMeasure * song.ticksPerBeat
        for (let track of song.tracks) {
            let bufNotes= song.buf.slice(track.noteEventStart+2, track.noteEventByteLength)
            const bufNotesNew =bufNotes.slice()
            let note = new music.sequencer.NoteEvent(bufNotesNew, 0)
            for(let j=1;j<count;j++){
                while (note.offset < track.noteEventStart + 2+track.noteEventByteLength){
                    note.startTick+=tickOffset
                    note.endTick+=tickOffset
                    note.offset+=note.byteLength
                }
                bufNotes=bufNotes.concat(bufNotesNew)
                note.offset=0
            }
            buf = buf
                .concat(song.buf.slice(concatStart, track.noteEventStart+2-concatStart))
                .concat(bufNotes)
            buf.setNumber(NumberFormat.UInt16LE, buf.length-bufNotes.length-2, track.noteEventByteLength* count) //noteEventByteLength
            concatStart = track.noteEventStart + 2 + track.noteEventByteLength
        }
        buf= buf.concat(song.buf.slice(concatStart))

        let song1 = new music.sequencer.Song(buf)
        song1.measures = song1.measures * count
        if(stitch)
            song1.measures-= count-1

        return song1
    }

    export function fill(song: music.sequencer.Song, newTrack:boolean, withsong: music.sequencer.Song, stitch = false){
        const withsong_repeated= repeat(withsong, Math.idiv(song.measures, withsong.measures), stitch)
        if(newTrack)
            return addTracks(song, withsong_repeated.tracks)
        else
            return merge(song, withsong_repeated)
    }
}