using SwarmUI.Core;
using SwarmUI.Utils;

namespace MonkeysDocs.Extensions.LoRAPlayground;

/// <summary>Extension that adds a simplified LoRA experimentation tab.</summary>
public class LoRAPlaygroundExtension : Extension
{
    public override void OnInit()
    {
        Logs.Init("LoRA Playground Extension loading...");
        
        // Register the JavaScript file
        ScriptFiles.Add("Assets/lora_playground.js");
        
        // Register the CSS file
        StyleSheetFiles.Add("Assets/lora_playground.css");
        
        Logs.Init("LoRA Playground Extension loaded successfully");
    }
}