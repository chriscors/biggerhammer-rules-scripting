# Duplicate Rule Variable

> Inserts a copy of an array element at source+1, shifting subsequent elements (increments $$<mode>_count but NOT caller's local $record_count)

## Script Text

```
# #Duplicate rule variable 
#  Creates a new global variable containing the data of the indicated source variable, and moves succeeding variables down.
#     These are variables used by the rule scripts.
# 
# @history
#  12/21/2016 - Marc Berning - Initial Version
# 
# @assumptions
#  Environment: Allow User Abort & Error Capture states are appropriately set.
#  Environment: The parameters have already been adequately validated.
# 
# @param num $source (req): the repetition number to be used as the source variable.  The new variable will be "positioned" immediately after the source.
# 
# @return num $error (req): non-zero indicates a problem
# @return text $message (cond): Human readable message about the general outcome of the script. Requied if error.
# 
# 
#  Single-iteration loop
Loop [ Flush: Always ]
# 
#  Parse out script parameters here.
Set Variable [ $scriptParams ; Value: Get ( ScriptParameter ) ]
Set Variable [ $source ; Value: GetAsNumber ( CF_getProperty ( $scriptParams; "source" )) ]
# 
#  Loop through each of the variable repitions AFTER the $source, moving them down/out to make room for the new variable.
Set Variable [ $i ; Value: Evaluate ( "$$" & $$this_mode & "_count" ) + 1 ]
Loop [ Flush: Always ]
Exit Loop If [ Let ( $i = $i - 1; $i < $source ) ]
Set Variable [ $null ; Value: Let ([ 	~var = "$$" & $$this_mode; 	~rep = ~var & "[$i]" ]; 	CF_SetVarByName ( ~var; $i + 1; Evaluate ( ~rep )) ) ]
End Loop
# 
#  Update the Record counter
If [ $$this_mode = "bill" ]
Set Variable [ $$bill_count ; Value: $$bill_count + 1 ]
Else
Set Variable [ $$pay_count ; Value: $$pay_count + 1 ]
End If
# 
Exit Loop If [ True		//  Always exit the single-iteration control loop to prevent infinite spin!  ]
End Loop
# 
#  Cleanup steps: close worker windows, gather script results, etc...
Set Variable [ $result ; Value: List	( 	"error="		& If ( IsEmpty ( $error ); 0; $error ); 	"message="	& CF_addPSlashes ( $message ); ) ]
# 
#  That's it - exit script!
Exit Script [ Text Result: $result		//  We always return the result variable  ]
# 

```
