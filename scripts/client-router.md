# Client Router

> Routes TCD batches from the UI script to the Contract Rules orchestrator

## Script Text

```
# #
#  Directs Contract Rule script execution according to client.
# 
# @history
#  05/25/2018 - Marc Berning - Initial Version
#  07/13/2018 - Marc Berning - added PSOS parameter
# 
# @param text $client (req): Company short name.
# 
# @return num $error (req): non-zero indicates a problem
# @return text $message (cond): Human readable message about the general outcome of the script. Requied if error.
# @return text $success_ids (cond): Delimited list of Time Card IDs that were successfully processed.
# 
# 
#  Required settings - do not modify!
Set Variable [ $errorCaptureOn ; Value: Get ( ErrorCaptureState ) ]
Set Variable [ $userAbortOn ; Value: Get ( AllowAbortState ) ]
#  Set as needed
Allow User Abort [ Off ]
Set Error Capture [ On ]
# 
#  Single-iteration loop
Loop [ Flush: Always ]
# 
#  Parse out script parameters here.
Set Variable [ $scriptParams ; Value: Get ( ScriptParameter ) ]
Set Variable [ $client ; Value: CF_getProperty ( $scriptParams; "client" ) ]
If [ Get ( LastError ) ]
Set Variable [ $error ; Value: Get ( LastError ) ]
Set Variable [ $message ; Value: "Could not process script's parameters, possibly due to missing Custom Functions." ]
Exit Loop If [ True ]
End If
# 
#  Validate required parameters
If [ IsEmpty ( $client ) ]
Set Variable [ $message ; Value: List ( 	$message; 	"Missing or invalid required parameter: client" ) ]
Exit Loop If [ Let ( $error = 1201; True ) ]
End If
# 
# 
#  Begin routing based on Client's (short) name
If [ False ]
# 
# 
#  The Apollo Theatre
Else If [ $client = "APOLLO" ]
If [ CF_PSOS_available and not CF_isDevServer ]
Perform Script on Server [ “Contract Rules - APOLLO” ; Specified: From list ; Parameter: Get ( ScriptParameter ) ; Wait for completion: On ]
If [ Get ( LastError ) = 812		//  Exceeded host’s capacity  ]
Perform Script [ “Contract Rules - APOLLO” ; Specified: From list ; Parameter: Get ( ScriptParameter ) ]
End If
Else
Perform Script [ “Contract Rules - APOLLO” ; Specified: From list ; Parameter: Get ( ScriptParameter ) ]
End If
# 
# 
# 
#  Austin Theatre Alliance
Else If [ $client = "ATA" ]
If [ CF_PSOS_available and not CF_isDevServer ]
Perform Script on Server [ “Contract Rules - ATA” ; Specified: From list ; Parameter: Get ( ScriptParameter ) ; Wait for completion: On ]
If [ Get ( LastError ) = 812		//  Exceeded host’s capacity  ]
Perform Script [ “Contract Rules - ATA” ; Specified: From list ; Parameter: Get ( ScriptParameter ) ]
End If
Else
Perform Script [ “Contract Rules - ATA” ; Specified: From list ; Parameter: Get ( ScriptParameter ) ]
End If
# 
# 
# 
#  Bigger Hammer Production Services
Else If [ $client = "Bigger Hammer" ]
If [ CF_PSOS_available and not CF_isDevServer ]
Perform Script on Server [ “Contract Rules - BH” ; Specified: From list ; Parameter: Get ( ScriptParameter ) ; Wait for completion: On ]
If [ Get ( LastError ) = 812		//  Exceeded host’s capacity  ]
Perform Script [ “Contract Rules - BH” ; Specified: From list ; Parameter: Get ( ScriptParameter ) ]
End If
Else
Perform Script [ “Contract Rules - BH” ; Specified: From list ; Parameter: Get ( ScriptParameter ) ]
End If
# 
# 
# 
#  Bigger Hammer Production Services
Else If [ $client = "Bigger Hammer Staff" ]
If [ CF_PSOS_available and not CF_isDevServer ]
Perform Script on Server [ “Contract Rules - BH Staff” ; Specified: From list ; Parameter: Get ( ScriptParameter ) ; Wait for completion: On ]
If [ Get ( LastError ) = 812		//  Exceeded host’s capacity  ]
Perform Script [ “Contract Rules - BH Staff” ; Specified: From list ; Parameter: Get ( ScriptParameter ) ]
End If
Else
Perform Script [ “Contract Rules - BH Staff” ; Specified: From list ; Parameter: Get ( ScriptParameter ) ]
End If
# 
# 
# 
#  Center Theatre Group
Else If [ $client = "CTG" ]
If [ CF_PSOS_available and not CF_isDevServer ]
Perform Script on Server [ “Contract Rules - CTG” ; Specified: From list ; Parameter: Get ( ScriptParameter ) ; Wait for completion: On ]
If [ Get ( LastError ) = 812		//  Exceeded host’s capacity  ]
Perform Script [ “Contract Rules - CTG” ; Specified: From list ; Parameter: Get ( ScriptParameter ) ]
End If
Else
Perform Script [ “Contract Rules - CTG” ; Specified: From list ; Parameter: Get ( ScriptParameter ) ]
End If
# 
# 
# 
#  The Fox Theatre, Inc
Else If [ $client = "Fox" ]
If [ CF_PSOS_available and not CF_isDevServer ]
Perform Script on Server [ “Contract Rules - Fox” ; Specified: From list ; Parameter: Get ( ScriptParameter ) ; Wait for completion: On ]
If [ Get ( LastError ) = 812		//  Exceeded host’s capacity  ]
Perform Script [ “Contract Rules - Fox” ; Specified: From list ; Parameter: Get ( ScriptParameter ) ]
End If
Else
Perform Script [ “Contract Rules - Fox” ; Specified: From list ; Parameter: Get ( ScriptParameter ) ]
End If
# 
# 
# 
#  Indiana Convention Center & Lucas Oil Stadium
Else If [ $client = "ICCLOS" ]
If [ CF_PSOS_available and not CF_isDevServer ]
Perform Script on Server [ “Contract Rules - ICCLOS” ; Specified: From list ; Parameter: Get ( ScriptParameter ) ; Wait for completion: On ]
If [ Get ( LastError ) = 812		//  Exceeded host’s capacity  ]
Perform Script [ “Contract Rules - ICCLOS” ; Specified: From list ; Parameter: Get ( ScriptParameter ) ]
End If
Else
Perform Script [ “Contract Rules - ICCLOS” ; Specified: From list ; Parameter: Get ( ScriptParameter ) ]
End If
# 
# 
# 
#  Yerba Buena Center for the Arts
Else If [ $client = "YBCA" ]
If [ CF_PSOS_available and not CF_isDevServer ]
Perform Script on Server [ “Contract Rules - YBCA” ; Specified: From list ; Parameter: Get ( ScriptParameter ) ; Wait for completion: On ]
If [ Get ( LastError ) = 812		//  Exceeded host’s capacity  ]
Perform Script [ “Contract Rules - YBCA” ; Specified: From list ; Parameter: Get ( ScriptParameter ) ]
End If
Else
Perform Script [ “Contract Rules - YBCA” ; Specified: From list ; Parameter: Get ( ScriptParameter ) ]
End If
# 
# 
# 
#  Everyone else
Else
If [ CF_PSOS_available and not CF_isDevServer ]
Perform Script on Server [ “Contract Rules - BH” ; Specified: From list ; Parameter: Get ( ScriptParameter ) ; Wait for completion: On ]
If [ Get ( LastError ) = 812		//  Exceeded host’s capacity  ]
Perform Script [ “Contract Rules - BH” ; Specified: From list ; Parameter: Get ( ScriptParameter ) ]
End If
Else
Perform Script [ “Contract Rules - BH” ; Specified: From list ; Parameter: Get ( ScriptParameter ) ]
End If
# 
End If
# 
# 
#  Evaluate the results of our efforts.
Set Variable [ $scriptResult ; Value: If ( Get ( LastError ); 	List ( "error=" & Get ( LastError ); "message=Perform Script error" ); 	Get ( ScriptResult ) ) ]
Set Variable [ $error ; Value: GetAsNumber ( CF_getProperty ( $scriptResult ; "error" )) ]
Set Variable [ $message ; Value: CF_getProperty ( $scriptResult ; "message" ) ]
Set Variable [ $success_ids ; Value: CF_getProperty ( $scriptResult; "success_ids" ) ]
Exit Loop If [ $error ]
# 
Exit Loop If [ True		//  Always exit the single-iteration control loop to prevent infinite spin!  ]
End Loop
# 
#  Cleanup steps: close worker windows, gather script results, etc...
Set Variable [ $result ; Value: List	( 	"error="			& If ( IsEmpty ( $error ); 0; $error ); 	"message="		& CF_addPSlashes ( $message ); 	"success_ids="	& CF_addPSlashes ( $success_ids ); ) ]
# 
#  Restore the error capture and user abort states.
If [ not $errorCaptureOn ]
Set Error Capture [ Off ]
End If
If [ $userAbortOn ]
Allow User Abort [ On ]
End If
# 
#  That's it - exit script!
Exit Script [ Text Result: $result		//  We always return the result variable  ]
# 

```
