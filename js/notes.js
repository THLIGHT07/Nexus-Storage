/* ============================================================
   NOTES.JS — Notes panel: create, save, delete, render
   ============================================================ */

/* ═══════════════════════════════════════════════════
   NOTES
═══════════════════════════════════════════════════ */
/* Init guard: _notesAbort is non-null while the Notes listeners are attached.
   initNotes() runs on EVERY login, so the wiring happens only once per login session;
   teardownNotes() (called from resetUserSession on sign-out/lock/block) removes the
   listeners and resets the guard, so the next login wires them exactly once again. */
let _notesAbort=null;
function initNotes(){
  if(!_notesAbort){
    _notesAbort=new AbortController();
    const opt={signal:_notesAbort.signal};
    document.getElementById("addNoteBtn").addEventListener("click",()=>{
      const f=document.getElementById("noteForm");f.classList.toggle("show");
      if(f.classList.contains("show"))document.getElementById("noteTitle").focus();
    },opt);
    document.getElementById("saveNoteBtn").addEventListener("click",saveNote,opt);
    document.getElementById("cancelNoteBtn").addEventListener("click",()=>document.getElementById("noteForm").classList.remove("show"),opt);
    document.getElementById("noteForm").addEventListener("keydown",e=>{if(e.key==="Enter"&&e.ctrlKey)saveNote();},opt);
  }
  renderNotes(); // always re-render: shows THIS login's notes
}
function teardownNotes(){
  if(_notesAbort){_notesAbort.abort();_notesAbort=null;}
}
function saveNote(){
  const title=document.getElementById("noteTitle").value.trim();
  const body=document.getElementById("noteBody").value.trim();
  if(!title&&!body){toast("Note is empty","ti-alert-circle");return;}
  saveNoteData(title,body);
  document.getElementById("noteTitle").value="";document.getElementById("noteBody").value="";
  document.getElementById("noteForm").classList.remove("show");
}
/* Pure data-driven note creation, reusable by AI tool calls (no DOM form needed) */
function saveNoteData(title,body){
  title=String(title==null?"":title).trim();body=String(body==null?"":body).trim(); // AI tool calls may pass non-strings
  if(!title&&!body)return{ok:false,error:"Note is empty"};
  const now=new Date();
  const note={id:uid(),title:title||"Untitled",body,date:`${now.getDate()}/${now.getMonth()+1} ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`};
  notes.unshift(note);
  p(LS.NOTES,notes);
  renderNotes();updateStats();toast("Note saved 📝","ti-notes");
  return{ok:true,note};
}
function deleteNote(id){notes=notes.filter(n=>n.id!==id);p(LS.NOTES,notes);renderNotes();updateStats();toast("Note deleted","ti-trash");}
function renderNotes(){
  const list=document.getElementById("notesList");list.replaceChildren();
  if(notes.length===0){list.appendChild(h("div",{class:"notes-empty"},h("i",{class:"ti ti-notes"}),"No notes yet. Create one!"));return;}
  notes.forEach(note=>{
    const del=h("button",{class:"note-card-del",title:"Delete note"},h("i",{class:"ti ti-trash"}));
    const card=h("div",{class:"note-card"},
      h("div",{class:"note-card-header"},h("span",{class:"note-card-title"},note.title),h("span",{class:"note-card-date"},note.date||"")),
      h("div",{class:"note-card-body"},note.body),
      del);
    del.addEventListener("click",()=>deleteNote(note.id));
    list.appendChild(card);
  });
}

