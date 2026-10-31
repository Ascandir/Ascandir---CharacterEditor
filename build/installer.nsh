; Keep the "models" folder (local AI: ComfyUI, models, TRELLIS) when the old version is removed during an update.
; A real uninstall removes everything.
!macro customRemoveFiles
  ${if} ${isUpdated}
    FindFirst $0 $1 "$INSTDIR\*.*"
    ace_loop:
      StrCmp $1 "" ace_done
      StrCmp $1 "." ace_next
      StrCmp $1 ".." ace_next
      StrCmp $1 "models" ace_next
      IfFileExists "$INSTDIR\$1\*.*" 0 ace_file
        RMDir /r "$INSTDIR\$1"
        Goto ace_next
      ace_file:
        Delete "$INSTDIR\$1"
      ace_next:
      FindNext $0 $1
      Goto ace_loop
    ace_done:
    FindClose $0
  ${else}
    RMDir /r $INSTDIR
  ${endif}
!macroend
