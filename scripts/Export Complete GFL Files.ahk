; AutoHotKey script to export Files from Action game

#SingleInstance Force
SetTitleMatchMode 2

^s::
{
; --- SECTION 1: LEAGUE EXPORT ---		
    if WinExist("Action! PC Football")
    {
        WinActivate
        WinWaitActive "Action! PC Football"
    }
    
    Send "!e" 
    Sleep 800
    Send "l"       
    
    if WinWaitActive("Export League Data", , 5)
    {
        Sleep 1000 
        Send "{Tab}"   
        Sleep 500
        ;Send "{Home}"
        ;Sleep 500
        Send "{Space}" 
        Sleep 500
        Send "{Tab 2}" 
        Sleep 500
        Send "{Space}" ; Clicks Export
    }

    ; --- NEW LOOPING WAIT SYSTEM ---
    Loop 60 ; This will try for 60 seconds (1 minutes)
    {
        if WinExist("Export complete")
        {
            WinActivate "Export complete"
            Sleep 1000
            SoundBeep 750, 500
            Send "{Enter}"
			break ;
            ;MsgBox "Export Finished and Closed!"
            ;return ; This exits the script once successful
        }
        Sleep 1000 ; Wait 1 second before checking again
    }

    ;MsgBox "The popup never appeared after 1 minutes."
	

; --- SECTION 2: STANDINGS EXPORT ---

    if WinExist("Action! PC Football")
    {
        WinActivate
        WinWaitActive "Action! PC Football"
    }
   
    Send "!e" 
    Sleep 800
	Send("{Left}")
	Sleep 800
	Send("{Left}")
	Sleep 800
	Send("{Left}")
	Sleep 800
	Send("{Down}")
    Sleep 800
	Send("{Down}")
    Sleep 800
	Send("{Down}")
    Sleep 800
	Send "{Enter}"
	Sleep 800
	Send "{Enter}"
	Sleep 1000

	SetTitleMatchMode 2 ; 2: A window's title can contain WinTitle anywhere inside it to be a match.

	if WinExist("TEMPAPC.TXT ahk_exe notepad.exe")
	{
	    WinActivate
		if WinWaitActive("TEMPAPC.TXT", , 3)
        {
			Send "!f" 
			Sleep 800
			Send("!a")
			Sleep 1000
			Send("GFLStandings.txt{Enter}")
			Sleep 1000
			Send "Y"
		}
	else
		{
			MsgBox "TEMPAPC.TXT is not open in Notepad."
		}
   
 	}
	
	; 1. Wait for the window to appear (Wait up to 5 seconds)
	if WinWait("Confirm Save As", , 5) 
	{
		WinActivate("Confirm Save As")
		Sleep(500) ; Brief pause to ensure the window is ready
		
		; 2. Send 'y' for Yes (or '!y' for Alt+Y)
		; Send("y") 
		Sleep(500) 
	}


; --- SECTION 2: SCHEDULE EXPORT ---	

    if WinExist("Action! PC Football")
    {
        WinActivate
        WinWaitActive "Action! PC Football"
    }

    Send "!o" 
    Sleep 800
	Send("{Down 4}")
	Send("{Enter}")
	Sleep 1000
	
	Send("y") 
	Sleep(500) 
	Send("!t") 
	Sleep(500)
	Send("{Up}")
	Sleep(500)
	Send("{Enter}")
	Sleep(500)
	
	if WinExist("Schedule Menu")
    {
		
        WinActivate
        WinWaitActive "Schedule Menu"
		Sleep(1000)
		;MsgBox "Schedule Window is open"
		Sleep(1000)
		Send("{Enter}")
		Sleep(1000)
    }
	else
	{
		MsgBox "No Schedule Window"
	}
	
	;MsgBox "End of script"	
	
}


; Emergency stop - Press Escape to kill the script if it gets stuck
Esc:: 
	{
	ExitApp()
	}